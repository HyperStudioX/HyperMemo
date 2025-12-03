create or replace function public.handle_new_bookmark()
returns trigger
language plpgsql
security definer
as $$
declare
  -- Production URL for project exjeyrnttrevrbwykmuj
  function_url text := 'https://exjeyrnttrevrbwykmuj.supabase.co/functions/v1/process-bookmark';
  secret_header text := 'hypermemo-webhook-secret';
begin
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
