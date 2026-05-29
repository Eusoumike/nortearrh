-- Remove trigger duplicado de geração de repasses RH (mantém apenas um)
DROP TRIGGER IF EXISTS trg_gerar_repasses_rh ON public.parcelas_rh_digital;

-- Recria função de geração de repasses RH ao pagamento, com guard mais estrito (status mudou para 'pago')
CREATE OR REPLACE FUNCTION public.gerar_repasses_rh_on_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD;
  ja_existe boolean;
BEGIN
  -- Apenas quando status muda PARA 'pago' (e não era 'pago' antes)
  IF NOT (TG_OP = 'UPDATE' AND NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago') THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$function$;

-- Garante que o trigger único existe e dispara apenas em mudanças de status
DROP TRIGGER IF EXISTS trg_gerar_repasses_rh_on_pagamento ON public.parcelas_rh_digital;
CREATE TRIGGER trg_gerar_repasses_rh_on_pagamento
  AFTER UPDATE OF status ON public.parcelas_rh_digital
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_repasses_rh_on_pagamento();