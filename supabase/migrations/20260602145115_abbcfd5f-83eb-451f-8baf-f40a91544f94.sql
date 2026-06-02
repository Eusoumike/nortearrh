ALTER TABLE public.parcelas_rh_digital
  DROP COLUMN IF EXISTS acrescimos,
  DROP COLUMN IF EXISTS valor_total_recebido,
  ADD COLUMN IF NOT EXISTS valor_nortear_recebido numeric;