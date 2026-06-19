
-- 1) Restrict SELECT policies to staff
DROP POLICY IF EXISTS "Lê itens de checklist" ON public.checklist_items;
CREATE POLICY "Lê itens de checklist" ON public.checklist_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê clientes" ON public.clients;
CREATE POLICY "Lê clientes" ON public.clients FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê etapas customizadas" ON public.custom_ticket_stages;
CREATE POLICY "Lê etapas customizadas" ON public.custom_ticket_stages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê eventos de implantação" ON public.implantacao_eventos;
CREATE POLICY "Lê eventos de implantação" ON public.implantacao_eventos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê pendências de implantação" ON public.implantacao_pendencias;
CREATE POLICY "Lê pendências de implantação" ON public.implantacao_pendencias FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê implantações" ON public.implantacoes;
CREATE POLICY "Lê implantações" ON public.implantacoes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Profiles visíveis para autenticados" ON public.profiles;
CREATE POLICY "Profiles visíveis para staff ou próprio" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR id = auth.uid());

DROP POLICY IF EXISTS "Lê tarefas" ON public.tasks;
CREATE POLICY "Lê tarefas" ON public.tasks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê classificações" ON public.ticket_categories;
CREATE POLICY "Lê classificações" ON public.ticket_categories FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê interações" ON public.ticket_interactions;
CREATE POLICY "Lê interações" ON public.ticket_interactions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê tempos de etapa" ON public.ticket_stage_times;
CREATE POLICY "Lê tempos de etapa" ON public.ticket_stage_times FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê histórico" ON public.ticket_status_history;
CREATE POLICY "Lê histórico" ON public.ticket_status_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê títulos de chamado" ON public.ticket_titles;
CREATE POLICY "Lê títulos de chamado" ON public.ticket_titles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Lê tickets" ON public.tickets;
CREATE POLICY "Lê tickets" ON public.tickets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 2) Harden is_staff to prevent arbitrary cross-user role checks
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','manager','agent')
      AND auth.uid() IS NOT NULL
      AND (
        _user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      )
  );
$function$;
