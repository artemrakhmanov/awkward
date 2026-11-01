-- Awkward schema (specs/api.md §3).
create extension if not exists vector with schema extensions;

create table public.anchors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  url text unique,                         -- normalised, see normaliseUrl
  starts_at timestamptz,
  place text,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  anchor_id uuid not null references public.anchors(id),
  public_summary text not null,            -- agent voice, shown on the board
  need text not null,
  offer text,
  private_notes text,                      -- matcher only, never returned publicly
  need_emb extensions.vector(1536),
  offer_emb extensions.vector(1536),
  agent_token_hash text unique not null,   -- sha256 hex
  human_token_hash text unique not null,   -- sha256 hex
  expires_at timestamptz not null,
  source text not null default 'mcp' check (source in ('mcp','web','api','seed')),
  seed_key text unique,
  status text not null default 'open' check (status in ('open','introduced','closed')),
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  anchor_id uuid not null references public.anchors(id),
  req_a uuid not null references public.requests(id) on delete cascade,
  req_b uuid not null references public.requests(id) on delete cascade,
  reason text not null,                    -- public, one line
  plan text not null,                      -- private, concrete
  a_status text not null default 'pending' check (a_status in ('pending','accepted','declined')),
  b_status text not null default 'pending' check (b_status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (req_a <> req_b)
);

create table public.reveals (
  match_id uuid not null references public.matches(id) on delete cascade,
  side text not null check (side in ('a','b')),
  first_name text not null,
  channel text not null check (channel in ('whatsapp','telegram','email','instagram','other')),
  handle text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',  -- reset to now() + 24h on the double yes
  primary key (match_id, side)
);

create unique index matches_pair on public.matches (least(req_a, req_b), greatest(req_a, req_b));
create index requests_anchor_status on public.requests (anchor_id, status);
create index matches_anchor on public.matches (anchor_id);

alter table public.anchors  enable row level security;
alter table public.requests enable row level security;
alter table public.matches  enable row level security;
alter table public.reveals  enable row level security;
-- No policies: only the server (secret key) reads or writes.

create or replace function public.search_anchors(
  query_embedding extensions.vector(1536), match_count int default 5
)
returns table (id uuid, slug text, title text, url text, starts_at timestamptz, place text, score float)
language sql stable set search_path = ''
as $$
  select a.id, a.slug, a.title, a.url, a.starts_at, a.place,
         1 - (a.embedding operator(extensions.<=>) query_embedding) as score
  from public.anchors a
  where a.embedding is not null
  order by a.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

create or replace function public.match_candidates(p_request_id uuid)
returns table (id uuid, public_summary text, need text, offer text, private_notes text)
language sql stable set search_path = ''
as $$
  with me as (
    select id, anchor_id, need_emb, offer_emb from public.requests where id = p_request_id
  ),
  pool as (
    select r.id, r.public_summary, r.need, r.offer, r.private_notes, r.need_emb, r.offer_emb
    from public.requests r, me
    where r.anchor_id = me.anchor_id
      and r.id <> me.id
      and r.status = 'open'
      and r.expires_at > now()
      and not exists (
        select 1 from public.matches m
        where least(m.req_a, m.req_b) = least(me.id, r.id)
          and greatest(m.req_a, m.req_b) = greatest(me.id, r.id)
      )
  ),
  their_offer_my_need as (
    select p.id from pool p, me where p.offer_emb is not null
    order by p.offer_emb operator(extensions.<=>) me.need_emb limit 10
  ),
  their_need_my_need as (
    select p.id from pool p, me
    order by p.need_emb operator(extensions.<=>) me.need_emb limit 5
  ),
  their_need_my_offer as (
    select p.id from pool p, me where me.offer_emb is not null
    order by p.need_emb operator(extensions.<=>) me.offer_emb limit 10
  )
  select p.id, p.public_summary, p.need, p.offer, p.private_notes
  from pool p
  where p.id in (
    select id from their_offer_my_need
    union select id from their_need_my_need
    union select id from their_need_my_offer
  );
$$;

-- Human accept: writes my reveal and my status in one transaction.
-- Returns 'waiting' | 'introduced' | 'declined' | 'expired' | 'not_found'
create or replace function public.accept_match(
  p_human_token_hash text, p_match_id uuid,
  p_first_name text, p_channel text, p_handle text
)
returns text
language plpgsql set search_path = ''
as $$
declare
  me public.requests;
  m public.matches;
  my_side text;
begin
  select * into me from public.requests where human_token_hash = p_human_token_hash;
  if not found then return 'not_found'; end if;
  if me.status = 'closed' or me.expires_at < now() then return 'expired'; end if;

  select * into m from public.matches where id = p_match_id for update;  -- serialises a simultaneous double accept
  if not found then return 'not_found'; end if;
  if m.req_a = me.id then my_side := 'a';
  elsif m.req_b = me.id then my_side := 'b';
  else return 'not_found'; end if;
  if (my_side = 'a' and m.a_status = 'declined') or (my_side = 'b' and m.b_status = 'declined') then
    return 'declined';
  end if;

  insert into public.reveals (match_id, side, first_name, channel, handle)
  values (m.id, my_side, p_first_name, p_channel, p_handle)
  on conflict (match_id, side) do update
    set first_name = excluded.first_name, channel = excluded.channel, handle = excluded.handle;

  if my_side = 'a' then
    update public.matches set a_status = 'accepted' where id = m.id returning * into m;
  else
    update public.matches set b_status = 'accepted' where id = m.id returning * into m;
  end if;

  if m.a_status = 'accepted' and m.b_status = 'accepted' then
    -- 24h window starts at the double yes; links stay valid for at least that long
    update public.requests
      set status = 'introduced', expires_at = greatest(expires_at, now() + interval '24 hours')
      where id in (m.req_a, m.req_b);
    update public.reveals set expires_at = now() + interval '24 hours' where match_id = m.id;
    return 'introduced';
  end if;
  return 'waiting';
end;
$$;

-- Decline with either token, only while my side is pending. Deletes every reveal on the match.
-- p_kind is 'agent' | 'human'. Returns 'declined' | 'not_pending' | 'expired' | 'not_found'
create or replace function public.decline_match(p_kind text, p_token_hash text, p_match_id uuid)
returns text
language plpgsql set search_path = ''
as $$
declare
  me public.requests;
  m public.matches;
begin
  if p_kind = 'agent' then
    select * into me from public.requests where agent_token_hash = p_token_hash;
  else
    select * into me from public.requests where human_token_hash = p_token_hash;
  end if;
  if not found then return 'not_found'; end if;
  if me.status = 'closed' or me.expires_at < now() then return 'expired'; end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found or me.id not in (m.req_a, m.req_b) then return 'not_found'; end if;
  if (m.req_a = me.id and m.a_status <> 'pending') or (m.req_b = me.id and m.b_status <> 'pending') then
    return 'not_pending';  -- an agent can never undo its human's accept
  end if;

  if m.req_a = me.id then
    update public.matches set a_status = 'declined' where id = m.id;
  else
    update public.matches set b_status = 'declined' where id = m.id;
  end if;
  delete from public.reveals where match_id = m.id;
  return 'declined';
end;
$$;

-- Supabase exposes every public function over its Data API: only the server role may call these.
revoke execute on function public.search_anchors, public.match_candidates,
  public.accept_match, public.decline_match from public, anon, authenticated;
grant execute on function public.search_anchors, public.match_candidates,
  public.accept_match, public.decline_match to service_role;

-- This project doesn't auto-grant new tables to the API roles.
grant select, insert, update, delete on public.anchors, public.requests, public.matches, public.reveals
  to service_role;

-- e2e runs match log rows to actors by this (specs/e2e.md §1).
alter table public.trial_log add column req_ref text;
