
-- 1) Backfill CNPJ from clients into denormalized tables
UPDATE public.lancamentos_vr lv
SET cnpj = c.cnpj
FROM public.clients c
WHERE lv.client_id = c.id
  AND c.cnpj IS NOT NULL AND c.cnpj <> ''
  AND (lv.cnpj IS NULL OR lv.cnpj = '' OR lv.cnpj <> c.cnpj);

UPDATE public.contratos_rh_digital cr
SET cnpj = c.cnpj
FROM public.clients c
WHERE cr.client_id = c.id
  AND c.cnpj IS NOT NULL AND c.cnpj <> ''
  AND (cr.cnpj IS NULL OR cr.cnpj = '' OR cr.cnpj <> c.cnpj);

UPDATE public.lancamentos_ponto lp
SET cnpj = c.cnpj
FROM public.clients c
WHERE lp.client_id = c.id
  AND c.cnpj IS NOT NULL AND c.cnpj <> ''
  AND (lp.cnpj IS NULL OR lp.cnpj = '' OR lp.cnpj <> c.cnpj);

UPDATE public.implantacoes i
SET cnpj = c.cnpj
FROM public.clients c
WHERE i.client_id = c.id
  AND c.cnpj IS NOT NULL AND c.cnpj <> ''
  AND (i.cnpj IS NULL OR i.cnpj = '' OR i.cnpj <> c.cnpj);

-- 2) Propagation trigger: when clients.cnpj changes, update all related rows
CREATE OR REPLACE FUNCTION public.propagar_cnpj_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cnpj IS NOT DISTINCT FROM OLD.cnpj THEN
    RETURN NEW;
  END IF;

  UPDATE public.lancamentos_vr SET cnpj = NEW.cnpj WHERE client_id = NEW.id;
  UPDATE public.contratos_rh_digital SET cnpj = NEW.cnpj WHERE client_id = NEW.id;
  UPDATE public.lancamentos_ponto SET cnpj = NEW.cnpj WHERE client_id = NEW.id;
  UPDATE public.implantacoes SET cnpj = NEW.cnpj WHERE client_id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.propagar_cnpj_cliente() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_client_cnpj_updated ON public.clients;
CREATE TRIGGER on_client_cnpj_updated
  AFTER UPDATE OF cnpj ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.propagar_cnpj_cliente();

-- 3) Insert triggers: pull CNPJ from client when creating new records
DROP TRIGGER IF EXISTS sync_cnpj_lancamentos_vr ON public.lancamentos_vr;
CREATE TRIGGER sync_cnpj_lancamentos_vr
  BEFORE INSERT ON public.lancamentos_vr
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_from_client();

DROP TRIGGER IF EXISTS sync_cnpj_contratos_rh ON public.contratos_rh_digital;
CREATE TRIGGER sync_cnpj_contratos_rh
  BEFORE INSERT ON public.contratos_rh_digital
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_from_client();

DROP TRIGGER IF EXISTS sync_cnpj_lancamentos_ponto ON public.lancamentos_ponto;
CREATE TRIGGER sync_cnpj_lancamentos_ponto
  BEFORE INSERT ON public.lancamentos_ponto
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_from_client();

DROP TRIGGER IF EXISTS sync_cnpj_implantacoes ON public.implantacoes;
CREATE TRIGGER sync_cnpj_implantacoes
  BEFORE INSERT ON public.implantacoes
  FOR EACH ROW EXECUTE FUNCTION public.sync_cnpj_from_client();
