-- Enum para tipo de produto no histórico
DO $$ BEGIN
  CREATE TYPE public.historico_comissao_produto AS ENUM ('vr_primeira_carga', 'vr_recorrencia', 'ponto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.historico_comissoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  cliente_nome text NOT NULL,
  produto public.historico_comissao_produto NOT NULL,
  percentual_anterior numeric,
  percentual_novo numeric NOT NULL,
  data_alteracao date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_a_partir date NOT NULL,
  retroativo boolean NOT NULL DEFAULT false,
  alterado_por text,
  alterado_por_id uuid,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_comissoes_client ON public.historico_comissoes(client_id);
CREATE INDEX IF NOT EXISTS idx_hist_comissoes_data ON public.historico_comissoes(data_alteracao DESC);

ALTER TABLE public.historico_comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê histórico comissões"
  ON public.historico_comissoes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin cria histórico comissões"
  ON public.historico_comissoes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin atualiza histórico comissões"
  ON public.historico_comissoes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin apaga histórico comissões"
  ON public.historico_comissoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));