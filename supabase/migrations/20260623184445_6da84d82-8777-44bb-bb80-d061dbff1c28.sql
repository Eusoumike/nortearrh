CREATE TABLE IF NOT EXISTS public.parcelas_rh_digital_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parcela_id uuid NOT NULL REFERENCES public.parcelas_rh_digital(id) ON DELETE CASCADE,
  acao text NOT NULL,
  valor_anterior numeric,
  data_pagamento_anterior date,
  motivo text,
  executado_por text,
  executado_por_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parcelas_rh_historico_parcela
  ON public.parcelas_rh_digital_historico(parcela_id);

GRANT SELECT, INSERT ON public.parcelas_rh_digital_historico TO authenticated;
GRANT ALL ON public.parcelas_rh_digital_historico TO service_role;

ALTER TABLE public.parcelas_rh_digital_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view historico parcelas rh"
  ON public.parcelas_rh_digital_historico
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin insert historico parcelas rh"
  ON public.parcelas_rh_digital_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
