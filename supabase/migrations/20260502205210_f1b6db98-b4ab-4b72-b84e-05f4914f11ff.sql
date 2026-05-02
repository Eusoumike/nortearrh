-- ============ Enum para status da parcela ============
CREATE TYPE public.parcela_rh_status AS ENUM ('pendente', 'pago', 'inadimplente');

-- ============ Tabela: contratos_rh_digital ============
CREATE TABLE public.contratos_rh_digital (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  cliente_nome text NOT NULL,
  cnpj text,
  valor_mensalidade numeric NOT NULL DEFAULT 0,
  percentual_nortear numeric NOT NULL DEFAULT 40,
  valor_nortear numeric NOT NULL DEFAULT 0,
  data_inicio date NOT NULL,
  fidelidade_meses integer NOT NULL,
  fidelidade_vencimento date,
  notificar_vencimento boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_rh_digital ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê contratos RH" ON public.contratos_rh_digital
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin cria contratos RH" ON public.contratos_rh_digital
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin atualiza contratos RH" ON public.contratos_rh_digital
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin apaga contratos RH" ON public.contratos_rh_digital
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_contratos_rh_client ON public.contratos_rh_digital(client_id);
CREATE INDEX idx_contratos_rh_ativo ON public.contratos_rh_digital(ativo);

-- ============ Tabela: parcelas_rh_digital ============
CREATE TABLE public.parcelas_rh_digital (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_rh_digital(id) ON DELETE CASCADE,
  client_id uuid,
  cliente_nome text NOT NULL,
  competencia date NOT NULL,
  valor_mensalidade numeric NOT NULL DEFAULT 0,
  percentual_nortear numeric NOT NULL DEFAULT 40,
  valor_nortear numeric NOT NULL DEFAULT 0,
  status public.parcela_rh_status NOT NULL DEFAULT 'pendente',
  data_pagamento date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, competencia)
);

ALTER TABLE public.parcelas_rh_digital ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê parcelas RH" ON public.parcelas_rh_digital
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin cria parcelas RH" ON public.parcelas_rh_digital
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin atualiza parcelas RH" ON public.parcelas_rh_digital
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin apaga parcelas RH" ON public.parcelas_rh_digital
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_parcelas_rh_contrato ON public.parcelas_rh_digital(contrato_id);
CREATE INDEX idx_parcelas_rh_client ON public.parcelas_rh_digital(client_id);
CREATE INDEX idx_parcelas_rh_competencia ON public.parcelas_rh_digital(competencia);
CREATE INDEX idx_parcelas_rh_status ON public.parcelas_rh_digital(status);

-- ============ Trigger: calcula campos derivados do contrato ============
CREATE OR REPLACE FUNCTION public.compute_contrato_rh_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.valor_nortear := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
  IF NEW.data_inicio IS NOT NULL AND NEW.fidelidade_meses IS NOT NULL THEN
    NEW.fidelidade_vencimento := (date_trunc('month', NEW.data_inicio)::date + (NEW.fidelidade_meses || ' months')::interval - interval '1 day')::date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contratos_rh_compute
BEFORE INSERT OR UPDATE ON public.contratos_rh_digital
FOR EACH ROW EXECUTE FUNCTION public.compute_contrato_rh_fields();

-- ============ Trigger: gera parcelas ao criar contrato ============
CREATE OR REPLACE FUNCTION public.gerar_parcelas_rh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  i integer;
  comp date;
  start_month date;
BEGIN
  start_month := date_trunc('month', NEW.data_inicio)::date;
  FOR i IN 0..(NEW.fidelidade_meses - 1) LOOP
    comp := (start_month + (i || ' months')::interval)::date;
    INSERT INTO public.parcelas_rh_digital (
      contrato_id, client_id, cliente_nome, competencia,
      valor_mensalidade, percentual_nortear, valor_nortear, status
    ) VALUES (
      NEW.id, NEW.client_id, NEW.cliente_nome, comp,
      NEW.valor_mensalidade, NEW.percentual_nortear, NEW.valor_nortear, 'pendente'
    )
    ON CONFLICT (contrato_id, competencia) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contratos_rh_gera_parcelas
AFTER INSERT ON public.contratos_rh_digital
FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_rh();

-- ============ Trigger: atualiza parcelas futuras ao editar contrato ============
CREATE OR REPLACE FUNCTION public.sync_parcelas_rh_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se valor ou percentual mudaram, atualizar parcelas futuras pendentes
  IF NEW.valor_mensalidade <> OLD.valor_mensalidade
     OR NEW.percentual_nortear <> OLD.percentual_nortear THEN
    UPDATE public.parcelas_rh_digital
    SET valor_mensalidade = NEW.valor_mensalidade,
        percentual_nortear = NEW.percentual_nortear,
        valor_nortear = ROUND(NEW.valor_mensalidade * NEW.percentual_nortear / 100.0, 2),
        updated_at = now()
    WHERE contrato_id = NEW.id
      AND status = 'pendente'
      AND competencia >= date_trunc('month', now())::date;
  END IF;

  -- Sincronizar nome do cliente em todas as parcelas (denormalizado)
  IF NEW.cliente_nome <> OLD.cliente_nome OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    UPDATE public.parcelas_rh_digital
    SET cliente_nome = NEW.cliente_nome,
        client_id = NEW.client_id,
        updated_at = now()
    WHERE contrato_id = NEW.id;
  END IF;

  -- Se contrato foi encerrado, remover parcelas futuras pendentes
  IF OLD.ativo = true AND NEW.ativo = false THEN
    DELETE FROM public.parcelas_rh_digital
    WHERE contrato_id = NEW.id
      AND status = 'pendente'
      AND competencia > date_trunc('month', now())::date;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contratos_rh_sync_parcelas
AFTER UPDATE ON public.contratos_rh_digital
FOR EACH ROW EXECUTE FUNCTION public.sync_parcelas_rh_on_update();

-- ============ Trigger: updated_at em parcelas ============
CREATE TRIGGER trg_parcelas_rh_updated_at
BEFORE UPDATE ON public.parcelas_rh_digital
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
