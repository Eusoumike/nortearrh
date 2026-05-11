-- Annual contracts: valor_mensalidade IS already the annual total. Don't multiply by 12.

CREATE OR REPLACE FUNCTION public.compute_contrato_rh_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_cobranca = 'anual' THEN
    -- Para anual, valor_mensalidade representa o valor total do ano
    NEW.valor_anual := COALESCE(NEW.valor_mensalidade, 0);
    NEW.valor_nortear := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
  ELSE
    NEW.valor_nortear := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
    NEW.valor_anual := ROUND(COALESCE(NEW.valor_mensalidade, 0) * 12, 2);
  END IF;
  IF NEW.data_inicio IS NOT NULL AND NEW.fidelidade_meses IS NOT NULL THEN
    NEW.fidelidade_vencimento := (date_trunc('month', NEW.data_inicio)::date + (NEW.fidelidade_meses || ' months')::interval - interval '1 day')::date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerar_parcelas_rh()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  i integer;
  comp date;
  start_month date;
  nortear_anual numeric;
BEGIN
  start_month := date_trunc('month', NEW.data_inicio)::date;

  IF NEW.tipo_cobranca = 'anual' THEN
    -- Para anual, valor_mensalidade já é o valor total anual
    nortear_anual := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
    INSERT INTO public.parcelas_rh_digital (
      contrato_id, client_id, cliente_nome, competencia,
      valor_mensalidade, percentual_nortear, valor_nortear, status, observacoes
    ) VALUES (
      NEW.id, NEW.client_id, NEW.cliente_nome, start_month,
      COALESCE(NEW.valor_mensalidade, 0), NEW.percentual_nortear, nortear_anual, 'pendente',
      'Contrato anual — pagamento único'
    )
    ON CONFLICT (contrato_id, competencia) DO NOTHING;
  ELSE
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
  END IF;
  RETURN NEW;
END;
$function$;

-- Cleanup any extra parcelas mistakenly created for annual contracts
WITH anuais AS (
  SELECT id FROM public.contratos_rh_digital WHERE tipo_cobranca = 'anual'
), keep AS (
  SELECT DISTINCT ON (contrato_id) id
  FROM public.parcelas_rh_digital
  WHERE contrato_id IN (SELECT id FROM anuais)
  ORDER BY contrato_id, competencia ASC
)
DELETE FROM public.parcelas_rh_digital
WHERE contrato_id IN (SELECT id FROM anuais)
  AND id NOT IN (SELECT id FROM keep);