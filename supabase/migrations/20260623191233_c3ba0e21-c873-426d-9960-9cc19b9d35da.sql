
-- Add base_status to map custom stages onto an existing ticket_status enum value
ALTER TABLE public.custom_ticket_stages
  ADD COLUMN IF NOT EXISTS base_status public.ticket_status NOT NULL DEFAULT 'em_atendimento';

-- Read access for any authenticated user; write access only for admins
DROP POLICY IF EXISTS "custom_ticket_stages_select_authenticated" ON public.custom_ticket_stages;
CREATE POLICY "custom_ticket_stages_select_authenticated"
ON public.custom_ticket_stages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "custom_ticket_stages_admin_write" ON public.custom_ticket_stages;
CREATE POLICY "custom_ticket_stages_admin_write"
ON public.custom_ticket_stages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_ticket_stages TO authenticated;
GRANT ALL ON public.custom_ticket_stages TO service_role;
