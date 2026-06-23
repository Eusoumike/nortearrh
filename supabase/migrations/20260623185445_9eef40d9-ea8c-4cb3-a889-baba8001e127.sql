
ALTER TABLE public.contratos_rh_digital
  ADD COLUMN IF NOT EXISTS percentual_cross_selling numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cross_selling numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.parcelas_rh_digital
  ADD COLUMN IF NOT EXISTS percentual_cross_selling numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cross_selling numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cross_selling_recebido numeric(10,2);

-- Atualiza trigger function do contrato para incluir cross_selling
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

  NEW.valor_cross_selling := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_cross_selling, 0) / 100.0, 2);

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

-- Atualiza trigger function que propaga mudanças para parcelas pendentes
CREATE OR REPLACE FUNCTION public.sync_parcelas_rh_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF ROUND(NEW.valor_mensalidade::numeric, 2) IS DISTINCT FROM ROUND(OLD.valor_mensalidade::numeric, 2)
     OR ROUND(NEW.percentual_nortear::numeric, 2) IS DISTINCT FROM ROUND(OLD.percentual_nortear::numeric, 2)
     OR ROUND(NEW.valor_nortear::numeric, 2) IS DISTINCT FROM ROUND(OLD.valor_nortear::numeric, 2)
     OR ROUND(COALESCE(NEW.percentual_cross_selling,0)::numeric, 2) IS DISTINCT FROM ROUND(COALESCE(OLD.percentual_cross_selling,0)::numeric, 2)
     OR ROUND(COALESCE(NEW.valor_cross_selling,0)::numeric, 2) IS DISTINCT FROM ROUND(COALESCE(OLD.valor_cross_selling,0)::numeric, 2) THEN
    UPDATE public.parcelas_rh_digital
    SET valor_mensalidade = ROUND(NEW.valor_mensalidade::numeric, 2),
        percentual_nortear = ROUND(NEW.percentual_nortear::numeric, 2),
        valor_nortear = ROUND(NEW.valor_nortear::numeric, 2),
        percentual_cross_selling = ROUND(COALESCE(NEW.percentual_cross_selling,0)::numeric, 2),
        valor_cross_selling = ROUND(COALESCE(NEW.valor_cross_selling,0)::numeric, 2),
        updated_at = now()
    WHERE contrato_id = NEW.id
      AND status = 'pendente';
  END IF;

  IF NEW.cliente_nome IS DISTINCT FROM OLD.cliente_nome OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    UPDATE public.parcelas_rh_digital
    SET cliente_nome = NEW.cliente_nome,
        client_id = NEW.client_id,
        updated_at = now()
    WHERE contrato_id = NEW.id;
  END IF;

  IF OLD.ativo = true AND NEW.ativo = false THEN
    DELETE FROM public.parcelas_rh_digital
    WHERE contrato_id = NEW.id
      AND status = 'pendente'
      AND competencia > date_trunc('month', now())::date;
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger BEFORE INSERT/UPDATE em parcelas para manter valor_cross_selling consistente
CREATE OR REPLACE FUNCTION public.compute_parcela_rh_cross_selling()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.valor_cross_selling := ROUND(
    COALESCE(NEW.valor_mensalidade,0) * COALESCE(NEW.percentual_cross_selling,0) / 100.0, 2
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_compute_parcela_rh_cross_selling ON public.parcelas_rh_digital;
CREATE TRIGGER trg_compute_parcela_rh_cross_selling
  BEFORE INSERT OR UPDATE OF valor_mensalidade, percentual_cross_selling
  ON public.parcelas_rh_digital
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_parcela_rh_cross_selling();

-- Atualiza função que gera parcelas para propagar campos cross_selling
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
        valor_mensalidade, percentual_nortear, valor_nortear,
        percentual_cross_selling, valor_cross_selling, status
      ) VALUES (
        NEW.id, NEW.client_id, NEW.cliente_nome, comp,
        NEW.valor_mensalidade, NEW.percentual_nortear, NEW.valor_nortear,
        COALESCE(NEW.percentual_cross_selling,0), COALESCE(NEW.valor_cross_selling,0), 'pendente'
      )
      ON CONFLICT (contrato_id, competencia) DO NOTHING;
    END LOOP;
  ELSIF NEW.tipo_cobranca = 'anual' THEN
    nortear_anual := ROUND(COALESCE(NEW.valor_mensalidade, 0) * COALESCE(NEW.percentual_nortear, 0) / 100.0, 2);
    INSERT INTO public.parcelas_rh_digital (
      contrato_id, client_id, cliente_nome, competencia,
      valor_mensalidade, percentual_nortear, valor_nortear,
      percentual_cross_selling, valor_cross_selling, status, observacoes
    ) VALUES (
      NEW.id, NEW.client_id, NEW.cliente_nome, start_month,
      COALESCE(NEW.valor_mensalidade, 0), NEW.percentual_nortear, nortear_anual,
      COALESCE(NEW.percentual_cross_selling,0), COALESCE(NEW.valor_cross_selling,0),
      'pendente', 'Contrato anual — pagamento único'
    )
    ON CONFLICT (contrato_id, competencia) DO NOTHING;
  ELSE
    FOR i IN 0..(NEW.fidelidade_meses - 1) LOOP
      comp := (start_month + (i || ' months')::interval)::date;
      INSERT INTO public.parcelas_rh_digital (
        contrato_id, client_id, cliente_nome, competencia,
        valor_mensalidade, percentual_nortear, valor_nortear,
        percentual_cross_selling, valor_cross_selling, status
      ) VALUES (
        NEW.id, NEW.client_id, NEW.cliente_nome, comp,
        NEW.valor_mensalidade, NEW.percentual_nortear, NEW.valor_nortear,
        COALESCE(NEW.percentual_cross_selling,0), COALESCE(NEW.valor_cross_selling,0), 'pendente'
      )
      ON CONFLICT (contrato_id, competencia) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- Sincronizar dados existentes (DEFAULT já preencheu, mas garantia explícita)
UPDATE public.contratos_rh_digital
   SET percentual_cross_selling = COALESCE(percentual_cross_selling, 0),
       valor_cross_selling = ROUND(COALESCE(valor_mensalidade,0) * COALESCE(percentual_cross_selling,0) / 100.0, 2)
 WHERE percentual_cross_selling IS NULL OR valor_cross_selling IS NULL;

UPDATE public.parcelas_rh_digital
   SET percentual_cross_selling = COALESCE(percentual_cross_selling, 0),
       valor_cross_selling = ROUND(COALESCE(valor_mensalidade,0) * COALESCE(percentual_cross_selling,0) / 100.0, 2)
 WHERE percentual_cross_selling IS NULL OR valor_cross_selling IS NULL;
