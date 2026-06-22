
-- 1) Add columns to tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS modulo TEXT,
  ADD COLUMN IF NOT EXISTS impacto TEXT,
  ADD COLUMN IF NOT EXISTS resultado_esperado TEXT,
  ADD COLUMN IF NOT EXISTS resultado_obtido TEXT,
  ADD COLUMN IF NOT EXISTS contato_nome TEXT,
  ADD COLUMN IF NOT EXISTS contato_cargo TEXT,
  ADD COLUMN IF NOT EXISTS contato_telefone TEXT;

-- 2) Add N2 supplier email to system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS email_n2_fornecedor TEXT;

-- 3) Add new enum value for interaction_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'interaction_type' AND e.enumlabel = 'email_n2'
  ) THEN
    ALTER TYPE public.interaction_type ADD VALUE 'email_n2';
  END IF;
END $$;

-- 4) Create ticket_emails_n2 table
CREATE TABLE IF NOT EXISTS public.ticket_emails_n2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  variante TEXT,
  destinatario TEXT,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  gerado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_emails_n2_ticket ON public.ticket_emails_n2(ticket_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_emails_n2 TO authenticated;
GRANT ALL ON public.ticket_emails_n2 TO service_role;

ALTER TABLE public.ticket_emails_n2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff vê emails N2" ON public.ticket_emails_n2
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff cria emails N2" ON public.ticket_emails_n2
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = gerado_por);

CREATE POLICY "Staff atualiza emails N2" ON public.ticket_emails_n2
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin/Manager apaga emails N2" ON public.ticket_emails_n2
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
