-- Item 5/6: single-select de produto + campos de desconto
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS product text,
  ADD COLUMN IF NOT EXISTS valor_contratado numeric,
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_com_desconto numeric,
  ADD COLUMN IF NOT EXISTS cargo text;

-- Backfill product a partir de products[]
UPDATE public.clients
SET product = CASE
  WHEN array_length(products, 1) IS NULL THEN NULL
  WHEN 'rh_digital' = ANY(products) AND 'vr_beneficios' = ANY(products) THEN 'rh_vr_beneficios'
  WHEN 'rh_digital' = ANY(products) THEN 'rh_digital'
  WHEN 'vr_beneficios' = ANY(products) THEN 'vr_beneficios'
  ELSE NULL
END
WHERE product IS NULL;

-- Backfill valor_contratado a partir de contract_value
UPDATE public.clients
SET valor_contratado = contract_value
WHERE valor_contratado IS NULL AND contract_value IS NOT NULL;

-- Trigger: calcula valor_com_desconto, mantém products[] e contract_value sincronizados
CREATE OR REPLACE FUNCTION public.sync_client_product_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- valor_com_desconto = valor_contratado * (1 - desconto/100)
  IF NEW.valor_contratado IS NOT NULL THEN
    NEW.valor_com_desconto := ROUND(NEW.valor_contratado * (1 - COALESCE(NEW.desconto_percentual, 0) / 100.0), 2);
  ELSE
    NEW.valor_com_desconto := NULL;
  END IF;

  -- Manter contract_value sincronizado com valor_com_desconto (ou valor_contratado se sem desconto)
  NEW.contract_value := COALESCE(NEW.valor_com_desconto, NEW.valor_contratado);

  -- Espelhar products[] a partir de product (single-select com combos)
  IF NEW.product IS NOT NULL THEN
    NEW.products := CASE NEW.product
      WHEN 'rh_digital' THEN ARRAY['rh_digital']::text[]
      WHEN 'vr_beneficios' THEN ARRAY['vr_beneficios']::text[]
      WHEN 'vr_multi' THEN ARRAY['vr_beneficios']::text[]
      WHEN 'multi_mobilidade' THEN ARRAY['vr_beneficios']::text[]
      WHEN 'rh_vr_beneficios' THEN ARRAY['rh_digital','vr_beneficios']::text[]
      WHEN 'rh_vr_multi' THEN ARRAY['rh_digital','vr_beneficios']::text[]
      WHEN 'rh_multi_mobilidade' THEN ARRAY['rh_digital','vr_beneficios']::text[]
      ELSE NEW.products
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_product_fields ON public.clients;
CREATE TRIGGER trg_sync_client_product_fields
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_product_fields();

-- Aplicar uma vez para popular valor_com_desconto/contract_value/products coerentes
UPDATE public.clients SET desconto_percentual = COALESCE(desconto_percentual, 0);