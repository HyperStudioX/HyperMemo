-- Allow NULL values for embedding column
alter table public.bookmarks alter column embedding drop not null;
