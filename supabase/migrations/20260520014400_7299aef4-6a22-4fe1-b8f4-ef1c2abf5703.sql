-- ============ DEALS: novos campos ============
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS plano_contratado text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS extensoes text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS quem_implanta text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS motivo_perda text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS canal_origem text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS faixa_colaboradores text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS etiqueta text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS segmento text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS origem_lead text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS fonte_indicacao text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS probabilidade text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS won_at timestamptz;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_at timestamptz;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NOT NULL DEFAULT now();

-- ============ CLIENTS: novos campos ============
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status_nortear text DEFAULT 'ativo_saudavel';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS fornecedor_beneficios text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS fornecedor_rh_digital text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS modulos_ativos text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS potencial_cross text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS segmento text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS faixa_colaboradores text;

-- ============ deal_activities ============
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  prioridade text NOT NULL DEFAULT 'media',
  agendado_para timestamptz,
  realizado_em timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  resultado text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON public.deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_activities_status ON public.deal_activities(status);
CREATE INDEX IF NOT EXISTS idx_deal_activities_agendado ON public.deal_activities(agendado_para);

ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê atividades CRM" ON public.deal_activities
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff cria atividades CRM" ON public.deal_activities
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza atividades CRM" ON public.deal_activities
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin/manager apaga atividades CRM" ON public.deal_activities
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER tr_deal_activities_updated_at
  BEFORE UPDATE ON public.deal_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ deal_contacts ============
CREATE TABLE IF NOT EXISTS public.deal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cargo text,
  papel text,
  email text,
  telefone text,
  whatsapp text,
  notas text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal ON public.deal_contacts(deal_id);

ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê contatos CRM" ON public.deal_contacts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff cria contatos CRM" ON public.deal_contacts
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza contatos CRM" ON public.deal_contacts
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin/manager apaga contatos CRM" ON public.deal_contacts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER tr_deal_contacts_updated_at
  BEFORE UPDATE ON public.deal_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ sales_metas ============
CREATE TABLE IF NOT EXISTS public.sales_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL,
  produto text NOT NULL DEFAULT 'todos',
  valor_meta numeric NOT NULL DEFAULT 0,
  quantidade_meta integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mes, produto)
);

ALTER TABLE public.sales_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê metas" ON public.sales_metas
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin/manager grava metas" ON public.sales_metas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admin/manager atualiza metas" ON public.sales_metas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admin/manager apaga metas" ON public.sales_metas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER tr_sales_metas_updated_at
  BEFORE UPDATE ON public.sales_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ deal_history ============
CREATE TABLE IF NOT EXISTS public.deal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_history_deal ON public.deal_history(deal_id);

ALTER TABLE public.deal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê histórico CRM" ON public.deal_history
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ Trigger: marcar won_at / lost_at + log de stage ============
CREATE OR REPLACE FUNCTION public.handle_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
    IF NEW.stage = 'fechado_ganho' AND OLD.stage <> 'fechado_ganho' THEN
      NEW.won_at := now();
    END IF;
    IF NEW.stage = 'fechado_perdido' AND OLD.stage <> 'fechado_perdido' THEN
      NEW.lost_at := now();
    END IF;
    INSERT INTO public.deal_history (deal_id, campo, valor_antigo, valor_novo, changed_by)
    VALUES (NEW.id, 'stage', OLD.stage::text, NEW.stage::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_deal_stage_change ON public.deals;
CREATE TRIGGER tr_deal_stage_change
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_stage_change();