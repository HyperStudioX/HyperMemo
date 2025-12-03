-- Enable the pg_cron extension
create extension if not exists pg_cron with schema extensions;

-- Create a function to clean up unused tags
create or replace function cleanup_unused_tags()
returns void
language plpgsql
security definer
as $$
begin
  delete from tags
  where id not in (select tag_id from bookmark_tags);
end;
$$;

-- Schedule the job to run daily at 3:00 AM (UTC)
-- The job name is 'cleanup-unused-tags'
select cron.schedule(
  'cleanup-unused-tags',
  '0 3 * * *',
  $$select cleanup_unused_tags()$$
);
