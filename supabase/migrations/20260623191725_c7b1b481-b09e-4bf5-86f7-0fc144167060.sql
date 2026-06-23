
CREATE OR REPLACE FUNCTION public.proteger_etapas_sistema()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'Etapas do sistema não podem ser excluídas';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_system_stages ON public.custom_ticket_stages;
CREATE TRIGGER protect_system_stages
  BEFORE DELETE ON public.custom_ticket_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_etapas_sistema();
