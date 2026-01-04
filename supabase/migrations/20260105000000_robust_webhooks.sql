-- Create a settings table for application-wide configuration
create table if not exists public.app_settings (
    key text primary key,
    value text not null,
    updated_at timestamptz default now()
);

-- Enable RLS (Service role only)
alter table public.app_settings enable row level security;
create policy "Service role only" on public.app_settings for all using (auth.role() = 'service_role');

-- Insert initial settings (Replace with actual values or use a script)
insert into public.app_settings (key, value)
values 
  ('edge_function_base_url', 'http://edge-runtime:8081/functions/v1'),
  ('webhook_secret', 'hypermemo-webhook-secret')
on conflict (key) do nothing;

-- Update the trigger function to be more robust and portable
create or replace function public.handle_new_bookmark()
returns trigger
language plpgsql
security definer
as $$
declare
  function_base_url text;
  webhook_secret text;
begin
  -- Fetch settings from the app_settings table
  select value into function_base_url from public.app_settings where key = 'edge_function_base_url';
  select value into webhook_secret from public.app_settings where key = 'webhook_secret';

  -- Default to local development if not set
  if function_base_url is null then
    function_base_url := 'http://edge-runtime:8081/functions/v1';
  end if;

  if webhook_secret is null then
    webhook_secret := 'hypermemo-webhook-secret';
  end if;

  -- Call the Edge Function
  perform net.http_post(
    url := function_base_url || '/process-bookmark',
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    )
  );
  return new;
end;
$$;
