
-- Enums
CREATE TYPE public.produto_parceiro AS ENUM ('rh_digital', 'vr_beneficios');
CREATE TYPE public.tipo_repasse_parceiro AS ENUM ('primeira_mensalidade', 'recorrencia', 'primeira_carga_vr');
CREATE TYPE public.status_repasse_parceiro AS ENUM ('pendente', 'pago');

-- Parceiros
CREATE TABLE public.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  contato text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê parceiros" ON public.parceiros FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin cria parceiros" ON public.parceiros FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza parceiros" ON public.parceiros FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin apaga parceiros" ON public.parceiros FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_parceiros_updated BEFORE UPDATE ON public.parceiros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configurações por cliente
CREATE TABLE public.configuracoes_parceiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  produto produto_parceiro NOT NULL,
  tipo_repasse tipo_repasse_parceiro NOT NULL,
  percentual numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parceiro_id, client_id, produto, tipo_repasse)
);
ALTER TABLE public.configuracoes_parceiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê config parceiro" ON public.configuracoes_parceiro FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin cria config parceiro" ON public.configuracoes_parceiro FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza config parceiro" ON public.configuracoes_parceiro FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin apaga config parceiro" ON public.configuracoes_parceiro FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_config_parceiro_updated BEFORE UPDATE ON public.configuracoes_parceiro
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Repasses
CREATE TABLE public.repasses_parceiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  parceiro_nome text NOT NULL,
  client_id uuid,
  cliente_nome text NOT NULL,
  produto produto_parceiro NOT NULL,
  tipo_repasse tipo_repasse_parceiro NOT NULL,
  percentual numeric NOT NULL DEFAULT 0,
  valor_base numeric NOT NULL DEFAULT 0,
  valor_repasse numeric NOT NULL DEFAULT 0,
  competencia date NOT NULL,
  status status_repasse_parceiro NOT NULL DEFAULT 'pendente',
  data_pagamento date,
  observacoes text,
  origem_id uuid, -- id da parcela_rh ou lancamento_vr
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.repasses_parceiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê repasses" ON public.repasses_parceiro FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin cria repasses" ON public.repasses_parceiro FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza repasses" ON public.repasses_parceiro FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin apaga repasses" ON public.repasses_parceiro FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_repasses_updated BEFORE UPDATE ON public.repasses_parceiro
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_repasses_parceiro ON public.repasses_parceiro(parceiro_id);
CREATE INDEX idx_repasses_client ON public.repasses_parceiro(client_id);
CREATE INDEX idx_repasses_status ON public.repasses_parceiro(status);

-- Campos no clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS fonte_indicacao text,
  ADD COLUMN IF NOT EXISTS parceiro_id uuid REFERENCES public.parceiros(id) ON DELETE SET NULL;

-- Função: gera repasses ao confirmar pagamento RH
CREATE OR REPLACE FUNCTION public.gerar_repasses_rh_on_pagamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg RECORD;
  ja_existe boolean;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago') THEN
    FOR cfg IN
      SELECT cp.*, p.nome AS parceiro_nome
      FROM public.configuracoes_parceiro cp
      JOIN public.parceiros p ON p.id = cp.parceiro_id
      WHERE cp.client_id = NEW.client_id
        AND cp.produto = 'rh_digital'
        AND cp.ativo = true
        AND p.ativo = true
    LOOP
      IF cfg.tipo_repasse = 'primeira_mensalidade' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.repasses_parceiro
          WHERE parceiro_id = cfg.parceiro_id
            AND client_id = NEW.client_id
            AND produto = 'rh_digital'
            AND tipo_repasse = 'primeira_mensalidade'
        ) INTO ja_existe;
        IF NOT ja_existe THEN
          INSERT INTO public.repasses_parceiro (
            parceiro_id, parceiro_nome, client_id, cliente_nome,
            produto, tipo_repasse, percentual, valor_base, valor_repasse,
            competencia, origem_id
          ) VALUES (
            cfg.parceiro_id, cfg.parceiro_nome, NEW.client_id, NEW.cliente_nome,
            'rh_digital', 'primeira_mensalidade', cfg.percentual,
            NEW.valor_nortear,
            ROUND(NEW.valor_nortear * cfg.percentual / 100.0, 2),
            NEW.competencia, NEW.id
          );
        END IF;
      ELSIF cfg.tipo_repasse = 'recorrencia' THEN
        -- evita duplicar mesma competência
        SELECT EXISTS (
          SELECT 1 FROM public.repasses_parceiro
          WHERE parceiro_id = cfg.parceiro_id
            AND client_id = NEW.client_id
            AND produto = 'rh_digital'
            AND tipo_repasse = 'recorrencia'
            AND competencia = NEW.competencia
        ) INTO ja_existe;
        IF NOT ja_existe THEN
          INSERT INTO public.repasses_parceiro (
            parceiro_id, parceiro_nome, client_id, cliente_nome,
            produto, tipo_repasse, percentual, valor_base, valor_repasse,
            competencia, origem_id
          ) VALUES (
            cfg.parceiro_id, cfg.parceiro_nome, NEW.client_id, NEW.cliente_nome,
            'rh_digital', 'recorrencia', cfg.percentual,
            NEW.valor_nortear,
            ROUND(NEW.valor_nortear * cfg.percentual / 100.0, 2),
            NEW.competencia, NEW.id
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_repasses_rh
AFTER UPDATE ON public.parcelas_rh_digital
FOR EACH ROW EXECUTE FUNCTION public.gerar_repasses_rh_on_pagamento();

-- Função: gera repasse VR primeira_carga
CREATE OR REPLACE FUNCTION public.gerar_repasses_vr_primeira_carga()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg RECORD;
  ja_existe boolean;
BEGIN
  IF NEW.tipo = 'primeira_carga' THEN
    FOR cfg IN
      SELECT cp.*, p.nome AS parceiro_nome
      FROM public.configuracoes_parceiro cp
      JOIN public.parceiros p ON p.id = cp.parceiro_id
      WHERE cp.client_id = NEW.client_id
        AND cp.produto = 'vr_beneficios'
        AND cp.tipo_repasse = 'primeira_carga_vr'
        AND cp.ativo = true
        AND p.ativo = true
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM public.repasses_parceiro
        WHERE parceiro_id = cfg.parceiro_id
          AND client_id = NEW.client_id
          AND produto = 'vr_beneficios'
          AND tipo_repasse = 'primeira_carga_vr'
      ) INTO ja_existe;
      IF NOT ja_existe THEN
        INSERT INTO public.repasses_parceiro (
          parceiro_id, parceiro_nome, client_id, cliente_nome,
          produto, tipo_repasse, percentual, valor_base, valor_repasse,
          competencia, origem_id
        ) VALUES (
          cfg.parceiro_id, cfg.parceiro_nome, NEW.client_id, NEW.cliente_nome,
          'vr_beneficios', 'primeira_carga_vr', cfg.percentual,
          NEW.valor_comissao,
          ROUND(NEW.valor_comissao * cfg.percentual / 100.0, 2),
          NEW.competencia, NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_repasses_vr
AFTER INSERT ON public.lancamentos_vr
FOR EACH ROW EXECUTE FUNCTION public.gerar_repasses_vr_primeira_carga();
