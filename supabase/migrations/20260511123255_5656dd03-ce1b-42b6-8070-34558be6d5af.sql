-- Permitir valor_base e valor_comissao nulos para recorrências aguardando preenchimento
ALTER TABLE public.lancamentos_vr ALTER COLUMN valor_base DROP NOT NULL;
ALTER TABLE public.lancamentos_vr ALTER COLUMN valor_base DROP DEFAULT;
ALTER TABLE public.lancamentos_vr ALTER COLUMN valor_comissao DROP NOT NULL;
ALTER TABLE public.lancamentos_vr ALTER COLUMN valor_comissao DROP DEFAULT;

-- Atualizar trigger para manter valor_comissao NULL quando valor_base for NULL
CREATE OR REPLACE FUNCTION public.compute_lancamento_vr_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.valor_base IS NULL THEN
    NEW.valor_comissao := NULL;
  ELSE
    NEW.valor_comissao := ROUND(COALESCE(NEW.valor_base, 0) * COALESCE(NEW.percentual_comissao, 0) / 100.0, 2);
  END IF;
  IF NEW.fidelidade_inicio IS NOT NULL AND NEW.fidelidade_meses IS NOT NULL THEN
    NEW.fidelidade_vencimento := (NEW.fidelidade_inicio + (NEW.fidelidade_meses || ' months')::interval)::date;
  END IF;
  RETURN NEW;
END;
$function$;