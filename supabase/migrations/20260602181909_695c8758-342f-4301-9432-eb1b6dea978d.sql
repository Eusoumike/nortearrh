
-- Attach trigger to sync pending parcelas when contract changes
DROP TRIGGER IF EXISTS on_contrato_rh_updated ON public.contratos_rh_digital;
CREATE TRIGGER on_contrato_rh_updated
  AFTER UPDATE ON public.contratos_rh_digital
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parcelas_rh_on_update();

-- Backfill: fix pending parcelas that drifted from their contract values
UPDATE public.parcelas_rh_digital p
SET
  valor_mensalidade = cr.valor_mensalidade,
  percentual_nortear = cr.percentual_nortear,
  valor_nortear = ROUND(cr.valor_mensalidade * cr.percentual_nortear / 100.0, 2),
  updated_at = now()
FROM public.contratos_rh_digital cr
WHERE p.contrato_id = cr.id
  AND p.status = 'pendente'
  AND p.competencia >= date_trunc('month', now())::date
  AND (
    p.valor_mensalidade IS DISTINCT FROM cr.valor_mensalidade
    OR p.percentual_nortear IS DISTINCT FROM cr.percentual_nortear
  );
