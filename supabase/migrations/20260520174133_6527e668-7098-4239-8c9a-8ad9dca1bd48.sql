
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS pipedrive_api_token text,
  ADD COLUMN IF NOT EXISTS pipedrive_user_name text,
  ADD COLUMN IF NOT EXISTS pipedrive_connected_at timestamptz;
