CREATE TABLE IF NOT EXISTS public.crm_cnpj_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  razao_social text,
  situacao text,
  resultado jsonb,
  deal_criado uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  consultado_por uuid,
  consultado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_cnpj_consultas_cnpj ON public.crm_cnpj_consultas(cnpj);
CREATE INDEX IF NOT EXISTS idx_crm_cnpj_consultas_created_at ON public.crm_cnpj_consultas(created_at DESC);

ALTER TABLE public.crm_cnpj_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê consultas CNPJ"
  ON public.crm_cnpj_consultas FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff cria consultas CNPJ"
  ON public.crm_cnpj_consultas FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Admin apaga consultas CNPJ"
  ON public.crm_cnpj_consultas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));