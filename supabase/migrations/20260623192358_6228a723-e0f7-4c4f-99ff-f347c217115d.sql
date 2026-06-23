
-- Remove old protection that blocked deletion of system-flagged stages
DROP TRIGGER IF EXISTS protect_system_stages ON public.custom_ticket_stages;
DROP FUNCTION IF EXISTS public.proteger_etapas_sistema();

-- New safeguard: prevent deleting a stage that still has tickets attached.
-- (Realocation happens in the app before delete; this is a backstop.)
CREATE OR REPLACE FUNCTION public.proteger_exclusao_etapa_com_chamados()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  qtd integer;
BEGIN
  SELECT COUNT(*) INTO qtd
  FROM public.tickets
  WHERE active_custom_stage_key = OLD.stage_key;

  IF qtd > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir a etapa "%": existem % chamado(s) vinculado(s). Realoque os chamados antes.', OLD.label, qtd;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS proteger_etapa_com_chamados ON public.custom_ticket_stages;
CREATE TRIGGER proteger_etapa_com_chamados
  BEFORE DELETE ON public.custom_ticket_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_exclusao_etapa_com_chamados();
