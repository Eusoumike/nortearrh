ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS anydesk_id text,
  ADD COLUMN IF NOT EXISTS anydesk_senha text;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS anydesk_senha text;