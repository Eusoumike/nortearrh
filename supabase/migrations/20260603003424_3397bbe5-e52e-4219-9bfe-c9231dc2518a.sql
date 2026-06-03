CREATE OR REPLACE FUNCTION public.sync_parcelas_rh_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se valor ou percentual mudaram, atualizar TODAS as parcelas pendentes (inclusive meses passados)
  IF NEW.valor_mensalidade <> OLD.valor_mensalidade
     OR NEW.percentual_nortear <> OLD.percentual_nortear THEN
    UPDATE public.parcelas_rh_digital
    SET valor_mensalidade = NEW.valor_mensalidade,
        percentual_nortear = NEW.percentual_nortear,
        valor_nortear = ROUND(NEW.valor_mensalidade * NEW.percentual_nortear / 100.0, 2),
        updated_at = now()
    WHERE contrato_id = NEW.id
      AND status = 'pendente';
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
$function$;

-- Backfill: corrigir parcelas pendentes existentes com valor desatualizado
UPDATE public.parcelas_rh_digital p
SET valor_mensalidade = cr.valor_mensalidade,
    percentual_nortear = cr.percentual_nortear,
    valor_nortear = ROUND(cr.valor_mensalidade * cr.percentual_nortear / 100.0, 2),
    updated_at = now()
FROM public.contratos_rh_digital cr
WHERE p.contrato_id = cr.id
  AND p.status = 'pendente'
  AND (p.valor_mensalidade <> cr.valor_mensalidade
       OR p.percentual_nortear <> cr.percentual_nortear);