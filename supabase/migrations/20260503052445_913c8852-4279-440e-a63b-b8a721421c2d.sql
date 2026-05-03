ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS percentual_vr_primeira_carga numeric NOT NULL DEFAULT 17.5,
  ADD COLUMN IF NOT EXISTS percentual_vr_recorrencia numeric NOT NULL DEFAULT 17.5,
  ADD COLUMN IF NOT EXISTS percentual_ponto numeric NOT NULL DEFAULT 40;