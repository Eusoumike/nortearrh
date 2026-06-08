
CREATE OR REPLACE FUNCTION public.propagar_dados_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_name text;
BEGIN
  org_name := COALESCE(NULLIF(NEW.razao_social,''), NULLIF(NEW.company,''), NEW.name);

  UPDATE public.tickets SET
    client_name  = COALESCE(NULLIF(NEW.contact_name,''), NEW.name),
    client_email = COALESCE(NULLIF(NEW.contact_email,''), NEW.email),
    client_phone = COALESCE(NULLIF(NEW.contact_phone,''), NEW.phone),
    organization = org_name
  WHERE client_id = NEW.id;

  UPDATE public.implantacoes SET
    client_name = org_name,
    cnpj        = NEW.cnpj
  WHERE client_id = NEW.id;

  UPDATE public.contratos_rh_digital SET
    cliente_nome = org_name,
    cnpj         = NEW.cnpj
  WHERE client_id = NEW.id;

  UPDATE public.parcelas_rh_digital SET
    cliente_nome = org_name
  WHERE client_id = NEW.id;

  UPDATE public.lancamentos_vr SET
    cliente_nome = org_name,
    cnpj         = NEW.cnpj
  WHERE client_id = NEW.id;

  UPDATE public.lancamentos_ponto SET
    cliente_nome = org_name,
    cnpj         = NEW.cnpj
  WHERE client_id = NEW.id;

  UPDATE public.repasses_parceiro SET
    cliente_nome = org_name
  WHERE client_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_client_updated ON public.clients;
CREATE TRIGGER on_client_updated
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.propagar_dados_cliente();

-- Backfill
UPDATE public.tickets t SET
  client_name  = COALESCE(NULLIF(c.contact_name,''), c.name),
  client_email = COALESCE(NULLIF(c.contact_email,''), c.email),
  client_phone = COALESCE(NULLIF(c.contact_phone,''), c.phone),
  organization = COALESCE(NULLIF(c.razao_social,''), NULLIF(c.company,''), c.name)
FROM public.clients c
WHERE t.client_id = c.id;

UPDATE public.implantacoes i SET
  client_name = COALESCE(NULLIF(c.razao_social,''), NULLIF(c.company,''), c.name),
  cnpj        = c.cnpj
FROM public.clients c
WHERE i.client_id = c.id;

UPDATE public.contratos_rh_digital cr SET
  cliente_nome = COALESCE(NULLIF(c.razao_social,''), NULLIF(c.company,''), c.name),
  cnpj         = c.cnpj
FROM public.clients c
WHERE cr.client_id = c.id;

UPDATE public.parcelas_rh_digital p SET
  cliente_nome = COALESCE(NULLIF(c.razao_social,''), NULLIF(c.company,''), c.name)
FROM public.clients c
WHERE p.client_id = c.id;

UPDATE public.lancamentos_vr lv SET
  cliente_nome = COALESCE(NULLIF(c.razao_social,''), NULLIF(c.company,''), c.name),
  cnpj         = c.cnpj
FROM public.clients c
WHERE lv.client_id = c.id;

UPDATE public.lancamentos_ponto lp SET
  cliente_nome = COALESCE(NULLIF(c.razao_social,''), NULLIF(c.company,''), c.name),
  cnpj         = c.cnpj
FROM public.clients c
WHERE lp.client_id = c.id;

UPDATE public.repasses_parceiro r SET
  cliente_nome = COALESCE(NULLIF(c.razao_social,''), NULLIF(c.company,''), c.name)
FROM public.clients c
WHERE r.client_id = c.id;
