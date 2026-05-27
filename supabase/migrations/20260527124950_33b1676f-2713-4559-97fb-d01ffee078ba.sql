CREATE TABLE IF NOT EXISTS public.assist_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE UNIQUE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assist_solutions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  categoria text,
  problema text,
  solucao text,
  links text[],
  confirmado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assist_conversations_ticket ON public.assist_conversations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_assist_solutions_categoria ON public.assist_solutions(categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assist_conversations TO authenticated;
GRANT ALL ON public.assist_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assist_solutions TO authenticated;
GRANT ALL ON public.assist_solutions TO service_role;

ALTER TABLE public.assist_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê assist_conversations" ON public.assist_conversations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff cria assist_conversations" ON public.assist_conversations
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza assist_conversations" ON public.assist_conversations
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin apaga assist_conversations" ON public.assist_conversations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff lê assist_solutions" ON public.assist_solutions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff cria assist_solutions" ON public.assist_solutions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza assist_solutions" ON public.assist_solutions
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin apaga assist_solutions" ON public.assist_solutions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP TRIGGER IF EXISTS update_assist_conversations_updated_at ON public.assist_conversations;
CREATE TRIGGER update_assist_conversations_updated_at
  BEFORE UPDATE ON public.assist_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();