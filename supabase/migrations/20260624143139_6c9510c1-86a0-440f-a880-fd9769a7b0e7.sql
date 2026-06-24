
-- Revoke public/anon execute on trigger function (no callers need it)
REVOKE EXECUTE ON FUNCTION public.log_ticket_etapa_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_ticket_etapa_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_ticket_etapa_change() FROM authenticated;

-- Remove overly permissive SELECT policy on custom_ticket_stages
DROP POLICY IF EXISTS custom_ticket_stages_select_authenticated ON public.custom_ticket_stages;

-- Tighten insert policy on ticket_etapa_historico to staff only
DROP POLICY IF EXISTS "Sistema grava historico" ON public.ticket_etapa_historico;
CREATE POLICY "Sistema grava historico"
  ON public.ticket_etapa_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
