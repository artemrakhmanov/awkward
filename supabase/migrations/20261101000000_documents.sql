-- pgvector store for RAG / semantic search
create extension if not exists vector with schema extensions;

create table public.documents (
  id bigint generated always as identity primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  -- 1536 = openai/text-embedding-3-small; change alongside EMBEDDING_MODEL
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create index documents_embedding_idx
  on public.documents
  using hnsw (embedding extensions.vector_cosine_ops);

-- No policies: only the server (secret key) can read/write.
alter table public.documents enable row level security;

create or replace function public.match_documents(
  query_embedding extensions.vector(1536),
  match_count int default 5,
  match_threshold float default 0.3
)
returns table (id bigint, content text, metadata jsonb, similarity float)
language sql
stable
set search_path = ''
as $$
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.documents d
  where 1 - (d.embedding operator(extensions.<=>) query_embedding) > match_threshold
  order by d.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;
