-- Backfill
UPDATE public.lancamentos_vr lv
SET cnpj = c.cnpj
FROM public.clients c
WHERE lv.client_id = c.id
  AND (lv.cnpj IS NULL OR lv.cnpj = '')
  AND c.cnpj IS NOT NULL AND c.cnpj <> '';

UPDATE public.contratos_rh_digital cr
SET cnpj = c.cnpj
FROM public.clients c
WHERE cr.client_id = c.id
  AND (cr.cnpj IS NULL OR cr.cnpj = '')
  AND c.cnpj IS NOT NULL AND c.cnpj <> '';

-- parcelas_rh_digital não tem coluna cnpj — pega via contrato no frontend.

-- Trigger function: copia CNPJ do cliente quando vazio
CREATE OR REPLACE FUNCTION public.sync_cnpj_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.cnpj IS NULL OR NEW.cnpj = '') AND NEW.client_id IS NOT NULL THEN
    SELECT cnpj INTO NEW.cnpj FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_cnpj_lancamento_vr ON public.lancamentos_vr;
CREATE TRIGGER sync_cnpj_lancamento_vr
  BEFORE INSERT OR UPDATE ON public.lancamentos_vr
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_from_client();

DROP TRIGGER IF EXISTS sync_cnpj_contrato_rh ON public.contratos_rh_digital;
CREATE TRIGGER sync_cnpj_contrato_rh
  BEFORE INSERT OR UPDATE ON public.contratos_rh_digital
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_from_client();

DROP TRIGGER IF EXISTS sync_cnpj_lancamento_ponto ON public.lancamentos_ponto;
CREATE TRIGGER sync_cnpj_lancamento_ponto
  BEFORE INSERT OR UPDATE ON public.lancamentos_ponto
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_from_client();