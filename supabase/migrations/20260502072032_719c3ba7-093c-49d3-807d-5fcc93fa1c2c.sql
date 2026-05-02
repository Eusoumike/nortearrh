-- ============================================================
-- Módulo Financeiro — Fase 1: schema, RLS (admin-only) e storage
-- ============================================================

-- Enums
CREATE TYPE public.lancamento_vr_tipo AS ENUM ('primeira_carga', 'recorrencia');
CREATE TYPE public.documento_financeiro_tipo AS ENUM ('nota_fiscal', 'boleto', 'outro');
CREATE TYPE public.documento_financeiro_status AS ENUM ('pendente', 'pago');

-- ============================================================
-- Tabela: lancamentos_vr
-- ============================================================
CREATE TABLE public.lancamentos_vr (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  cnpj TEXT,
  competencia DATE NOT NULL,
  tipo public.lancamento_vr_tipo NOT NULL DEFAULT 'recorrencia',
  valor_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  percentual_comissao NUMERIC(6,3) NOT NULL DEFAULT 17.5,
  valor_comissao NUMERIC(14,2) NOT NULL DEFAULT 0,
  fidelidade_meses INTEGER,
  fidelidade_inicio DATE,
  fidelidade_vencimento DATE,
  notificar_vencimento BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lancamentos_vr_client ON public.lancamentos_vr(client_id);
CREATE INDEX idx_lancamentos_vr_competencia ON public.lancamentos_vr(competencia DESC);
CREATE INDEX idx_lancamentos_vr_fidelidade ON public.lancamentos_vr(fidelidade_vencimento) WHERE notificar_vencimento = true;

-- ============================================================
-- Tabela: lancamentos_ponto
-- ============================================================
CREATE TABLE public.lancamentos_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  cnpj TEXT,
  competencia DATE NOT NULL,
  valor_mensalidade NUMERIC(14,2) NOT NULL DEFAULT 0,
  percentual_nortear NUMERIC(6,3) NOT NULL DEFAULT 40,
  valor_nortear NUMERIC(14,2) NOT NULL DEFAULT 0,
  fidelidade_meses INTEGER,
  fidelidade_inicio DATE,
  fidelidade_vencimento DATE,
  notificar_vencimento BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lancamentos_ponto_client ON public.lancamentos_ponto(client_id);
CREATE INDEX idx_lancamentos_ponto_competencia ON public.lancamentos_ponto(competencia DESC);
CREATE INDEX idx_lancamentos_ponto_fidelidade ON public.lancamentos_ponto(fidelidade_vencimento) WHERE notificar_vencimento = true;

-- ============================================================
-- Tabela: documentos_financeiros
-- ============================================================
CREATE TABLE public.documentos_financeiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  competencia DATE NOT NULL,
  tipo public.documento_financeiro_tipo NOT NULL DEFAULT 'outro',
  descricao TEXT,
  valor NUMERIC(14,2),
  arquivo_url TEXT,
  arquivo_nome TEXT,
  status_pagamento public.documento_financeiro_status NOT NULL DEFAULT 'pendente',
  data_pagamento DATE,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_financeiros_client ON public.documentos_financeiros(client_id);
CREATE INDEX idx_documentos_financeiros_competencia ON public.documentos_financeiros(competencia DESC);

-- ============================================================
-- Tabela: config_comissoes
-- ============================================================
CREATE TABLE public.config_comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  percentual_vr_primeira_carga NUMERIC(6,3) NOT NULL DEFAULT 17.5,
  percentual_vr_recorrencia NUMERIC(6,3) NOT NULL DEFAULT 17.5,
  percentual_ponto NUMERIC(6,3) NOT NULL DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Triggers de updated_at e cálculo de fidelidade/valor
-- ============================================================

CREATE TRIGGER trg_lancamentos_vr_updated_at
  BEFORE UPDATE ON public.lancamentos_vr
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lancamentos_ponto_updated_at
  BEFORE UPDATE ON public.lancamentos_ponto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_documentos_financeiros_updated_at
  BEFORE UPDATE ON public.documentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_config_comissoes_updated_at
  BEFORE UPDATE ON public.config_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função: recalcula valor_comissao e fidelidade_vencimento (VR)
CREATE OR REPLACE FUNCTION public.compute_lancamento_vr_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.valor_comissao := ROUND(COALESCE(NEW.valor_base, 0) * COALESCE(NEW.percentual_comissao, 0) / 100.0, 2);
  IF NEW.fidelidade_inicio IS NOT NULL AND NEW.fidelidade_meses IS NOT NULL THEN
    NEW.fidelidade_vencimento := (NEW.fidelidade_inicio + (NEW.fidelidade_meses || ' months')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lancamentos_vr_compute
  BEFORE INSERT OR UPDATE ON public.lancamentos_vr
  FOR EACH ROW EXECUTE FUNCTION public.compute_lancamento_vr_fields();

-- Função: recalcula valor_nortear e fidelidade_vencimento (Ponto)
CREATE OR REPLACE FUNCTION public.compute_lancamento_ponto_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.valor_nortear := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
  IF NEW.fidelidade_inicio IS NOT NULL AND NEW.fidelidade_meses IS NOT NULL THEN
    NEW.fidelidade_vencimento := (NEW.fidelidade_inicio + (NEW.fidelidade_meses || ' months')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lancamentos_ponto_compute
  BEFORE INSERT OR UPDATE ON public.lancamentos_ponto
  FOR EACH ROW EXECUTE FUNCTION public.compute_lancamento_ponto_fields();

-- ============================================================
-- RLS: apenas admin
-- ============================================================
ALTER TABLE public.lancamentos_vr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_comissoes ENABLE ROW LEVEL SECURITY;

-- lancamentos_vr
CREATE POLICY "Admin lê lançamentos VR" ON public.lancamentos_vr
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin cria lançamentos VR" ON public.lancamentos_vr
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza lançamentos VR" ON public.lancamentos_vr
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin apaga lançamentos VR" ON public.lancamentos_vr
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- lancamentos_ponto
CREATE POLICY "Admin lê lançamentos Ponto" ON public.lancamentos_ponto
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin cria lançamentos Ponto" ON public.lancamentos_ponto
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza lançamentos Ponto" ON public.lancamentos_ponto
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin apaga lançamentos Ponto" ON public.lancamentos_ponto
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- documentos_financeiros
CREATE POLICY "Admin lê documentos financeiros" ON public.documentos_financeiros
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin cria documentos financeiros" ON public.documentos_financeiros
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza documentos financeiros" ON public.documentos_financeiros
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin apaga documentos financeiros" ON public.documentos_financeiros
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- config_comissoes
CREATE POLICY "Admin lê config comissões" ON public.config_comissoes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin cria config comissões" ON public.config_comissoes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza config comissões" ON public.config_comissoes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin apaga config comissões" ON public.config_comissoes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Storage bucket: documentos-financeiros (privado, admin-only)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-financeiros', 'documentos-financeiros', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin lê documentos financeiros (storage)"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-financeiros' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin envia documentos financeiros (storage)"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-financeiros' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin atualiza documentos financeiros (storage)"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-financeiros' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin apaga documentos financeiros (storage)"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-financeiros' AND public.has_role(auth.uid(), 'admin'));
