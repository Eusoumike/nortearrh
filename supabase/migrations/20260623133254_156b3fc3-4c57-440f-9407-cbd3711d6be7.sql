
ALTER TABLE public.ticket_emails_n2 ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_emails_n2 TO authenticated;
GRANT ALL ON public.ticket_emails_n2 TO service_role;

DROP POLICY IF EXISTS "Staff manage ticket_emails_n2" ON public.ticket_emails_n2;
CREATE POLICY "Staff manage ticket_emails_n2"
  ON public.ticket_emails_n2
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
