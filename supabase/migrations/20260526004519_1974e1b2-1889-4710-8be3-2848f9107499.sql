ALTER TABLE public.parcelas_rh_digital
  ADD COLUMN IF NOT EXISTS acrescimos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_recebido numeric;