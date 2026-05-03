ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS products text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS contract_value numeric,
  ADD COLUMN IF NOT EXISTS onboarding_iniciado_em timestamptz;