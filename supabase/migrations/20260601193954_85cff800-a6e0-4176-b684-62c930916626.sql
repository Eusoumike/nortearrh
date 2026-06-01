ALTER TABLE public.parcelas_rh_digital
  ADD COLUMN IF NOT EXISTS valor_recebido numeric,
  ADD COLUMN IF NOT EXISTS diferenca_valor numeric;