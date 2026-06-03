CREATE OR REPLACE FUNCTION public.sync_parcelas_rh_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se valor ou percentual mudaram, atualizar TODAS as parcelas pendentes com arredondamento consistente.
  IF ROUND(NEW.valor_mensalidade::numeric, 2) IS DISTINCT FROM ROUND(OLD.valor_mensalidade::numeric, 2)
     OR ROUND(NEW.percentual_nortear::numeric, 2) IS DISTINCT FROM ROUND(OLD.percentual_nortear::numeric, 2)
     OR ROUND(NEW.valor_nortear::numeric, 2) IS DISTINCT FROM ROUND(OLD.valor_nortear::numeric, 2) THEN
    UPDATE public.parcelas_rh_digital
    SET valor_mensalidade = ROUND(NEW.valor_mensalidade::numeric, 2),
        percentual_nortear = ROUND(NEW.percentual_nortear::numeric, 2),
        valor_nortear = ROUND(NEW.valor_nortear::numeric, 2),
        updated_at = now()
    WHERE contrato_id = NEW.id
      AND status = 'pendente';
  END IF;

  -- Sincronizar nome do cliente em todas as parcelas (denormalizado)
  IF NEW.cliente_nome IS DISTINCT FROM OLD.cliente_nome OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
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
$function$;

DROP TRIGGER IF EXISTS on_contrato_rh_updated ON public.contratos_rh_digital;
DROP TRIGGER IF EXISTS trg_contratos_rh_sync_parcelas ON public.contratos_rh_digital;
DROP TRIGGER IF EXISTS on_contrato_mensalidade_alterada ON public.contratos_rh_digital;

CREATE TRIGGER on_contrato_rh_updated
  AFTER UPDATE OF valor_mensalidade, percentual_nortear, valor_nortear, cliente_nome, client_id, ativo
  ON public.contratos_rh_digital
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parcelas_rh_on_update();