
-- Helper: is internal staff (agent or above)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','manager','agent')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- checklist_items
DROP POLICY IF EXISTS "Apaga itens de checklist" ON public.checklist_items;
DROP POLICY IF EXISTS "Atualiza itens de checklist" ON public.checklist_items;
DROP POLICY IF EXISTS "Cria itens de checklist" ON public.checklist_items;
CREATE POLICY "Apaga itens de checklist" ON public.checklist_items FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Atualiza itens de checklist" ON public.checklist_items FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria itens de checklist" ON public.checklist_items FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- clients
DROP POLICY IF EXISTS "Atualiza clientes" ON public.clients;
DROP POLICY IF EXISTS "Cria clientes" ON public.clients;
CREATE POLICY "Atualiza clientes" ON public.clients FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria clientes" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- deals
DROP POLICY IF EXISTS "Atualiza negócios" ON public.deals;
DROP POLICY IF EXISTS "Cria negócios" ON public.deals;
CREATE POLICY "Atualiza negócios" ON public.deals FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria negócios" ON public.deals FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- implantacao_eventos
DROP POLICY IF EXISTS "Cria eventos de implantação" ON public.implantacao_eventos;
CREATE POLICY "Cria eventos de implantação" ON public.implantacao_eventos FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- implantacao_pendencias
DROP POLICY IF EXISTS "Apaga pendências de implantação" ON public.implantacao_pendencias;
DROP POLICY IF EXISTS "Atualiza pendências de implantação" ON public.implantacao_pendencias;
DROP POLICY IF EXISTS "Cria pendências de implantação" ON public.implantacao_pendencias;
CREATE POLICY "Apaga pendências de implantação" ON public.implantacao_pendencias FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Atualiza pendências de implantação" ON public.implantacao_pendencias FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria pendências de implantação" ON public.implantacao_pendencias FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- implantacoes
DROP POLICY IF EXISTS "Atualiza implantações" ON public.implantacoes;
DROP POLICY IF EXISTS "Cria implantações" ON public.implantacoes;
CREATE POLICY "Atualiza implantações" ON public.implantacoes FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria implantações" ON public.implantacoes FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- nps_responses: tighten SELECT + UPDATE
DROP POLICY IF EXISTS "Usuários internos leem respostas NPS" ON public.nps_responses;
DROP POLICY IF EXISTS "Usuários internos atualizam respostas NPS" ON public.nps_responses;
CREATE POLICY "Usuários internos leem respostas NPS" ON public.nps_responses FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR has_role(auth.uid(),'viewer'));
CREATE POLICY "Usuários internos atualizam respostas NPS" ON public.nps_responses FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- tasks
DROP POLICY IF EXISTS "Atualiza tarefas" ON public.tasks;
DROP POLICY IF EXISTS "Cria tarefas" ON public.tasks;
CREATE POLICY "Atualiza tarefas" ON public.tasks FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria tarefas" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ticket_categories
DROP POLICY IF EXISTS "Atualiza classificações" ON public.ticket_categories;
DROP POLICY IF EXISTS "Cria classificações" ON public.ticket_categories;
CREATE POLICY "Atualiza classificações" ON public.ticket_categories FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria classificações" ON public.ticket_categories FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ticket_interactions
DROP POLICY IF EXISTS "Cria interações" ON public.ticket_interactions;
CREATE POLICY "Cria interações" ON public.ticket_interactions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = author_id);

-- ticket_stage_times
DROP POLICY IF EXISTS "Sistema/usuário atualiza tempos de etapa" ON public.ticket_stage_times;
DROP POLICY IF EXISTS "Sistema/usuário grava tempos de etapa" ON public.ticket_stage_times;
CREATE POLICY "Sistema/usuário atualiza tempos de etapa" ON public.ticket_stage_times FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Sistema/usuário grava tempos de etapa" ON public.ticket_stage_times FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ticket_titles
DROP POLICY IF EXISTS "Atualiza títulos de chamado" ON public.ticket_titles;
DROP POLICY IF EXISTS "Cria títulos de chamado" ON public.ticket_titles;
CREATE POLICY "Atualiza títulos de chamado" ON public.ticket_titles FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Cria títulos de chamado" ON public.ticket_titles FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Revoke EXECUTE on SECURITY DEFINER trigger/helper functions from anon and public.
-- Keep authenticated EXECUTE only on functions invoked from the client via RPC.
REVOKE EXECUTE ON FUNCTION public.compute_contrato_rh_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_ticket_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_repasses_rh_on_pagamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_first_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_kanban_stage_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_repasses_vr_primeira_carga() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_default_ticket_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_ticket_custom_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_ticket_sla_deadline() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_client_nps() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_client_nps_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_client_product_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_lancamento_vr_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_lancamento_ponto_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_parcelas_rh_on_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas_rh() FROM PUBLIC, anon, authenticated;

-- Functions called via RPC from authenticated client — revoke from anon only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_remove_user_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_access(uuid) TO authenticated;
