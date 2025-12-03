-- Enable pg_net extension
create extension if not exists "pg_net";

-- Create the trigger function
create or replace function public.handle_new_bookmark()
returns trigger
language plpgsql
security definer
as $$
declare
  -- URL for the Edge Function. 
  -- NOTE: In production, replace this with your actual project URL: https://<project-ref>.supabase.co/functions/v1/process-bookmark
  -- For local development, we use the internal Docker DNS name.
  function_url text := 'http://edge-runtime:8081/functions/v1/process-bookmark';
  secret_header text := 'hypermemo-webhook-secret';
begin
  -- Call the Edge Function
  perform net.http_post(
    url := function_url,
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', secret_header
    )
  );
  return new;
end;
$$;

-- Create the trigger
drop trigger if exists on_bookmark_created on public.bookmarks;
create trigger on_bookmark_created
  after insert on public.bookmarks
  for each row
  execute procedure public.handle_new_bookmark();
