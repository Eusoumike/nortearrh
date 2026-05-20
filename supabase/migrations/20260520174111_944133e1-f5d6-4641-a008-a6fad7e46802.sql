
-- Colunas faltantes em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS nps_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS nps_score integer,
  ADD COLUMN IF NOT EXISTS nps_data timestamptz,
  ADD COLUMN IF NOT EXISTS pipedrive_person_id text;

-- Enums para deals
DO $$ BEGIN
  CREATE TYPE public.deal_stage AS ENUM ('lead','contato','apresentacao','negociacao','fechado_ganho','fechado_perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deal_product AS ENUM ('vr_beneficios','rh_digital','ambos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela deals
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  client_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  value numeric NOT NULL DEFAULT 0,
  product public.deal_product,
  stage public.deal_stage NOT NULL DEFAULT 'lead',
  expected_close_date date,
  notes text,
  owner_id uuid,
  created_by uuid,
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff lê deals" ON public.deals;
CREATE POLICY "Staff lê deals" ON public.deals FOR SELECT TO authenticated USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff cria deals" ON public.deals;
CREATE POLICY "Staff cria deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff atualiza deals" ON public.deals;
CREATE POLICY "Staff atualiza deals" ON public.deals FOR UPDATE TO authenticated USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admin/manager apaga deals" ON public.deals;
CREATE POLICY "Admin/manager apaga deals" ON public.deals FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

DROP TRIGGER IF EXISTS deals_set_updated_at ON public.deals;
CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS deals_stage_change ON public.deals;
CREATE TRIGGER deals_stage_change BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_stage_change();

-- Tabela deal_history (referenciada pelo trigger handle_deal_stage_change)
CREATE TABLE IF NOT EXISTS public.deal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff lê deal_history" ON public.deal_history;
CREATE POLICY "Staff lê deal_history" ON public.deal_history FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- Tabela nps_responses
CREATE TABLE IF NOT EXISTS public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  empresa text NOT NULL DEFAULT '',
  tempo_cliente text,
  frequencia_uso text,
  nota_atendimento integer,
  atendimento_evolucao text,
  tempo_resposta text,
  confianca_informacoes integer,
  nps_score integer,
  feedback_aberto text,
  experiencia_geral text,
  sugestao_melhoria text,
  comentario_adicional text,
  client_id uuid,
  token text,
  source text NOT NULL DEFAULT 'form',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff lê nps_responses" ON public.nps_responses;
CREATE POLICY "Staff lê nps_responses" ON public.nps_responses FOR SELECT TO authenticated USING (is_staff(auth.uid()));
DROP POLICY IF EXISTS "Público cria nps_responses" ON public.nps_responses;
CREATE POLICY "Público cria nps_responses" ON public.nps_responses FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin/manager apaga nps_responses" ON public.nps_responses;
CREATE POLICY "Admin/manager apaga nps_responses" ON public.nps_responses FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

DROP TRIGGER IF EXISTS nps_sync_client ON public.nps_responses;
CREATE TRIGGER nps_sync_client BEFORE INSERT ON public.nps_responses
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_nps();

DROP TRIGGER IF EXISTS nps_update_client_score ON public.nps_responses;
CREATE TRIGGER nps_update_client_score AFTER INSERT ON public.nps_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_client_nps_score();
