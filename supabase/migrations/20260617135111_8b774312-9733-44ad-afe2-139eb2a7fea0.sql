
CREATE TABLE IF NOT EXISTS public.implantacao_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantacao_templates TO authenticated;
GRANT ALL ON public.implantacao_templates TO service_role;
ALTER TABLE public.implantacao_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpl owner all" ON public.implantacao_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tpl staff read" ON public.implantacao_templates FOR SELECT USING (public.is_staff(auth.uid()));
CREATE TRIGGER trg_impl_templates_updated BEFORE UPDATE ON public.implantacao_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.implantacao_template_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.implantacao_templates(id) ON DELETE CASCADE,
  nome text NOT NULL,
  icone text DEFAULT 'task_alt',
  cor text DEFAULT '#3B82F6',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantacao_template_categorias TO authenticated;
GRANT ALL ON public.implantacao_template_categorias TO service_role;
ALTER TABLE public.implantacao_template_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpl cat via parent" ON public.implantacao_template_categorias FOR ALL
  USING (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND t.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.implantacao_template_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.implantacao_templates(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.implantacao_template_categorias(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  prazo_dias_offset integer,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantacao_template_tarefas TO authenticated;
GRANT ALL ON public.implantacao_template_tarefas TO service_role;
ALTER TABLE public.implantacao_template_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpl task via parent" ON public.implantacao_template_tarefas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND (t.user_id = auth.uid() OR public.is_staff(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.implantacao_templates t WHERE t.id = template_id AND t.user_id = auth.uid()));
