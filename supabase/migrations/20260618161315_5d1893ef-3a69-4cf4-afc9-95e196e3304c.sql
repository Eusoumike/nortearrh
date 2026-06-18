DROP POLICY IF EXISTS "tpl owner all" ON public.implantacao_templates;
DROP POLICY IF EXISTS "tpl staff read" ON public.implantacao_templates;
DROP POLICY IF EXISTS "tpl cat via parent" ON public.implantacao_template_categorias;
DROP POLICY IF EXISTS "tpl task via parent" ON public.implantacao_template_tarefas;

CREATE POLICY "tpl owner all" ON public.implantacao_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tpl staff read" ON public.implantacao_templates
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "tpl cat via parent" ON public.implantacao_template_categorias
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND t.user_id = auth.uid()));

CREATE POLICY "tpl task via parent" ON public.implantacao_template_tarefas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND t.user_id = auth.uid()));