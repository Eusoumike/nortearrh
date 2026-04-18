
-- 1) Substituir o enum implantacao_etapa pelos novos valores.
-- Cria novo enum, migra os dados (todos para 'novo_cliente') e troca o tipo da coluna.
ALTER TYPE public.implantacao_etapa RENAME TO implantacao_etapa_old;

CREATE TYPE public.implantacao_etapa AS ENUM (
  'novo_cliente',
  'boas_vindas',
  'treinamento_1',
  'treinamento_2',
  'treinamento_3',
  'finalizado'
);

-- Remover default antigo, trocar o tipo (todos viram novo_cliente), redefinir default
ALTER TABLE public.implantacoes ALTER COLUMN etapa DROP DEFAULT;
ALTER TABLE public.implantacoes
  ALTER COLUMN etapa TYPE public.implantacao_etapa
  USING 'novo_cliente'::public.implantacao_etapa;
ALTER TABLE public.implantacoes
  ALTER COLUMN etapa SET DEFAULT 'novo_cliente'::public.implantacao_etapa;

DROP TYPE public.implantacao_etapa_old;

-- 2) Novos campos em implantacoes
ALTER TABLE public.implantacoes
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS email_cliente text,
  ADD COLUMN IF NOT EXISTS telefone_cliente text,
  ADD COLUMN IF NOT EXISTS contato_cliente text,
  ADD COLUMN IF NOT EXISTS responsavel_email text;

-- 3) Tabela de itens de checklist
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  implantacao_id uuid NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  etapa public.implantacao_etapa NOT NULL,
  label text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_impl_etapa
  ON public.checklist_items(implantacao_id, etapa, ordem);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê itens de checklist"
  ON public.checklist_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Cria itens de checklist"
  ON public.checklist_items FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'viewer'::public.app_role));

CREATE POLICY "Atualiza itens de checklist"
  ON public.checklist_items FOR UPDATE TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'::public.app_role));

CREATE POLICY "Apaga itens de checklist"
  ON public.checklist_items FOR DELETE TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'::public.app_role));

CREATE TRIGGER update_checklist_items_updated_at
  BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Tabela de configuração de etapas (por usuário)
CREATE TABLE IF NOT EXISTS public.implantacao_stage_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  stage_key text NOT NULL,
  label text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  is_custom boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, stage_key)
);

ALTER TABLE public.implantacao_stage_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê próprias configs de etapa"
  ON public.implantacao_stage_configs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Cria próprias configs de etapa"
  ON public.implantacao_stage_configs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Atualiza próprias configs de etapa"
  ON public.implantacao_stage_configs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Apaga próprias configs de etapa"
  ON public.implantacao_stage_configs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_impl_stage_configs_updated_at
  BEFORE UPDATE ON public.implantacao_stage_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
