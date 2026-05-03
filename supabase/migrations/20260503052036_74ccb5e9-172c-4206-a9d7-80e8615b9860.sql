-- Tipo de cobrança em contratos RH Digital
CREATE TYPE public.tipo_cobranca_rh AS ENUM ('mensal','anual');

ALTER TABLE public.contratos_rh_digital
  ADD COLUMN tipo_cobranca public.tipo_cobranca_rh NOT NULL DEFAULT 'mensal',
  ADD COLUMN valor_anual numeric NOT NULL DEFAULT 0;

-- Recalcular valor_nortear/valor_anual no trigger de compute
CREATE OR REPLACE FUNCTION public.compute_contrato_rh_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.valor_nortear := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
  NEW.valor_anual := ROUND(COALESCE(NEW.valor_mensalidade, 0) * 12, 2);
  IF NEW.data_inicio IS NOT NULL AND NEW.fidelidade_meses IS NOT NULL THEN
    NEW.fidelidade_vencimento := (date_trunc('month', NEW.data_inicio)::date + (NEW.fidelidade_meses || ' months')::interval - interval '1 day')::date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Atualizar geração de parcelas para suportar contrato anual (parcela única)
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
  valor_anual_calc numeric;
  nortear_anual numeric;
BEGIN
  start_month := date_trunc('month', NEW.data_inicio)::date;

  IF NEW.tipo_cobranca = 'anual' THEN
    valor_anual_calc := ROUND(COALESCE(NEW.valor_mensalidade, 0) * 12, 2);
    nortear_anual := ROUND(valor_anual_calc * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
    INSERT INTO public.parcelas_rh_digital (
      contrato_id, client_id, cliente_nome, competencia,
      valor_mensalidade, percentual_nortear, valor_nortear, status, observacoes
    ) VALUES (
      NEW.id, NEW.client_id, NEW.cliente_nome, start_month,
      valor_anual_calc, NEW.percentual_nortear, nortear_anual, 'pendente',
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