-- Enable pgvector extension
create extension if not exists vector;

-- Change embedding column type from double precision[] to vector(1536)
-- We need to cast the existing data. Since direct cast might not work if data is empty or incompatible,
-- we'll handle it carefully.
-- First, drop the default value if any
alter table public.bookmarks alter column embedding drop default;

-- Then alter the type using a USING clause to cast the array to vector
alter table public.bookmarks 
  alter column embedding type vector(1536) 
  using embedding::vector(1536);

-- Set the default back to empty vector (though vector doesn't support empty array literal '{}' the same way, usually NULL is better for no embedding)
-- But if we want a default, we can't easily set a zero-vector of length 1536 as a simple default string without being verbose.
-- Let's set default to NULL which is more semantic for "no embedding yet".
alter table public.bookmarks alter column embedding set default null;

-- Create an HNSW index for faster similarity search
-- This requires the vector extension to be enabled
create index if not exists bookmarks_embedding_idx 
  on public.bookmarks 
  using hnsw (embedding vector_cosine_ops);

-- Create a function to match bookmarks using pgvector
create or replace function match_bookmarks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id uuid,
  filter_tag_ids uuid[] default null
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  url text,
  summary text,
  raw_content text,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    b.id,
    b.user_id,
    b.title,
    b.url,
    b.summary,
    b.raw_content,
    coalesce(
      (
        select array_agg(t.name)
        from bookmark_tags bt
        join tags t on t.id = bt.tag_id
        where bt.bookmark_id = b.id
      ),
      '{}'::text[]
    ) as tags,
    b.created_at,
    b.updated_at,
    1 - (b.embedding <=> query_embedding) as similarity
  from public.bookmarks b
  where 1 - (b.embedding <=> query_embedding) > match_threshold
  and b.user_id = filter_user_id
  and (
    filter_tag_ids is null 
    or 
    exists (
      select 1 from bookmark_tags bt 
      where bt.bookmark_id = b.id 
      and bt.tag_id = any(filter_tag_ids)
    )
  )
  order by b.embedding <=> query_embedding
  limit match_count;
end;
$$;
