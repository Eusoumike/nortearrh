-- Enums
CREATE TYPE public.deal_product AS ENUM ('vr_beneficios', 'rh_digital', 'ambos');
CREATE TYPE public.deal_stage AS ENUM ('lead', 'contato', 'apresentacao', 'negociacao', 'fechado_ganho', 'fechado_perdido');

-- Tabela deals
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  value NUMERIC(14,2) NOT NULL DEFAULT 0,
  product public.deal_product,
  stage public.deal_stage NOT NULL DEFAULT 'lead',
  expected_close_date DATE,
  notes TEXT,
  pipedrive_deal_id TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  owner_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_deals_owner ON public.deals(owner_id);
CREATE INDEX idx_deals_client ON public.deals(client_id);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê negócios" ON public.deals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Cria negócios" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'viewer'::public.app_role));

CREATE POLICY "Atualiza negócios" ON public.deals
  FOR UPDATE TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'::public.app_role));

CREATE POLICY "Apaga negócios" ON public.deals
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();