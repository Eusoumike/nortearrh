
-- 1) Schema changes
ALTER TABLE public.contratos_rh_digital
  ADD COLUMN IF NOT EXISTS tipo_periodo text NOT NULL DEFAULT 'fidelidade',
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

ALTER TABLE public.contratos_rh_digital
  DROP CONSTRAINT IF EXISTS contratos_rh_digital_tipo_periodo_check;
ALTER TABLE public.contratos_rh_digital
  ADD CONSTRAINT contratos_rh_digital_tipo_periodo_check
  CHECK (tipo_periodo IN ('fidelidade','enquanto_ativo'));

ALTER TABLE public.contratos_rh_digital
  ALTER COLUMN fidelidade_meses DROP NOT NULL;

-- 2) Update compute trigger: skip fidelidade_vencimento when enquanto_ativo
CREATE OR REPLACE FUNCTION public.compute_contrato_rh_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_cobranca = 'anual' THEN
    NEW.valor_anual := COALESCE(NEW.valor_mensalidade, 0);
    NEW.valor_nortear := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
  ELSE
    NEW.valor_nortear := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
    NEW.valor_anual := ROUND(COALESCE(NEW.valor_mensalidade, 0) * 12, 2);
  END IF;

  IF NEW.tipo_periodo = 'enquanto_ativo' THEN
    NEW.fidelidade_meses := NULL;
    NEW.fidelidade_vencimento := NULL;
  ELSIF NEW.data_inicio IS NOT NULL AND NEW.fidelidade_meses IS NOT NULL THEN
    NEW.fidelidade_vencimento := (date_trunc('month', NEW.data_inicio)::date + (NEW.fidelidade_meses || ' months')::interval - interval '1 day')::date;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 3) Update installment generator: 12 future months for "enquanto_ativo"
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

  IF NEW.tipo_periodo = 'enquanto_ativo' THEN
    FOR i IN 0..11 LOOP
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
  ELSIF NEW.tipo_cobranca = 'anual' THEN
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

-- 4) Monthly rollover function for "enquanto_ativo" contracts
CREATE OR REPLACE FUNCTION public.gerar_parcela_enquanto_ativo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prox_comp date;
BEGIN
  prox_comp := (date_trunc('month', now())::date + interval '1 month')::date;

  INSERT INTO public.parcelas_rh_digital (
    contrato_id, client_id, cliente_nome, competencia,
    valor_mensalidade, percentual_nortear, valor_nortear, status
  )
  SELECT
    cr.id, cr.client_id, cr.cliente_nome, prox_comp,
    cr.valor_mensalidade, cr.percentual_nortear, cr.valor_nortear, 'pendente'
  FROM public.contratos_rh_digital cr
  WHERE cr.tipo_periodo = 'enquanto_ativo'
    AND cr.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.parcelas_rh_digital p
      WHERE p.contrato_id = cr.id AND p.competencia = prox_comp
    );
END;
$function$;

-- 5) Schedule monthly job (day 1 at 03:00 UTC). Pure SQL, no secrets.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rh-digital-enquanto-ativo-monthly') THEN
    PERFORM cron.unschedule('rh-digital-enquanto-ativo-monthly');
  END IF;
  PERFORM cron.schedule(
    'rh-digital-enquanto-ativo-monthly',
    '0 3 1 * *',
    $cron$ SELECT public.gerar_parcela_enquanto_ativo(); $cron$
  );
END$$;
