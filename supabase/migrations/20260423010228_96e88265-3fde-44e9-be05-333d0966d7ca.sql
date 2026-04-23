-- 1. Add training recording/transcription URL fields to implantacoes
ALTER TABLE public.implantacoes
  ADD COLUMN IF NOT EXISTS gravacao_t1 text,
  ADD COLUMN IF NOT EXISTS transcricao_t1 text,
  ADD COLUMN IF NOT EXISTS gravacao_t2 text,
  ADD COLUMN IF NOT EXISTS transcricao_t2 text,
  ADD COLUMN IF NOT EXISTS gravacao_t3 text,
  ADD COLUMN IF NOT EXISTS transcricao_t3 text;

-- 2. Timeline / history events table
CREATE TABLE IF NOT EXISTS public.implantacao_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  implantacao_id uuid NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'mudanca_etapa' | 'checklist_concluido' | 'checklist_desmarcado' | 'mensagem' | 'anotacao' | 'pendencia'
  descricao text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  autor_id uuid,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_implantacao_eventos_impl ON public.implantacao_eventos(implantacao_id, created_at DESC);

ALTER TABLE public.implantacao_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê eventos de implantação"
  ON public.implantacao_eventos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Cria eventos de implantação"
  ON public.implantacao_eventos FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Apaga eventos de implantação"
  ON public.implantacao_eventos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 3. Pendências por etapa
CREATE TABLE IF NOT EXISTS public.implantacao_pendencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  implantacao_id uuid NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  etapa public.implantacao_etapa NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (implantacao_id, etapa)
);

CREATE INDEX IF NOT EXISTS idx_implantacao_pendencias_impl ON public.implantacao_pendencias(implantacao_id);

ALTER TABLE public.implantacao_pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê pendências de implantação"
  ON public.implantacao_pendencias FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Cria pendências de implantação"
  ON public.implantacao_pendencias FOR INSERT TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Atualiza pendências de implantação"
  ON public.implantacao_pendencias FOR UPDATE TO authenticated
  USING (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Apaga pendências de implantação"
  ON public.implantacao_pendencias FOR DELETE TO authenticated
  USING (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE TRIGGER update_implantacao_pendencias_updated_at
  BEFORE UPDATE ON public.implantacao_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();