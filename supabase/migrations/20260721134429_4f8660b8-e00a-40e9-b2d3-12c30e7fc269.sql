
CREATE TABLE public.consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  situacao_cadastral TEXT,
  dados_receita JSONB,
  encontrado_no_pipedrive BOOLEAN NOT NULL DEFAULT false,
  acao TEXT,
  pipedrive_org_id BIGINT,
  consultado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  consultado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consultado_por_nome TEXT
);

CREATE INDEX idx_consultas_cnpj ON public.consultas(cnpj);
CREATE INDEX idx_consultas_consultado_em ON public.consultas(consultado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultas TO authenticated;
GRANT ALL ON public.consultas TO service_role;

ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pode ver consultas"
  ON public.consultas FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff pode criar consultas"
  ON public.consultas FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Admin pode atualizar consultas"
  ON public.consultas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode excluir consultas"
  ON public.consultas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
