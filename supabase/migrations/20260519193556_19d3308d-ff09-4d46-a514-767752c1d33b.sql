
CREATE TABLE IF NOT EXISTS public.assist_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE UNIQUE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assist_solutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

ALTER TABLE public.assist_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_solutions ENABLE ROW LEVEL SECURITY;

-- assist_conversations: staff-only
CREATE POLICY "Staff lê conversas assist" ON public.assist_conversations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff cria conversas assist" ON public.assist_conversations
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza conversas assist" ON public.assist_conversations
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff apaga conversas assist" ON public.assist_conversations
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- assist_solutions: staff-only (delete só admin)
CREATE POLICY "Staff lê soluções assist" ON public.assist_solutions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff cria soluções assist" ON public.assist_solutions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza soluções assist" ON public.assist_solutions
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin apaga soluções assist" ON public.assist_solutions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_assist_conversations_updated_at
  BEFORE UPDATE ON public.assist_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
