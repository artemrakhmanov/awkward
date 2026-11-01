-- Trial log (specs/trial.md). Posts live here too: route = '/api/requests' and result = 'ok'.
create table public.trial_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  door text not null,            -- 'http' | 'mcp' | 'doc' | 'human'
  route text not null,           -- path or MCP tool name
  user_agent text,
  auth_via text,                 -- 'header' | 'query' | 'none'
  body jsonb,                    -- request body with tokens removed
  result text                    -- 'ok' | error code
);
-- No policies: only the server (secret key) can read/write.
alter table public.trial_log enable row level security;
