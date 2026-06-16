CREATE TABLE IF NOT EXISTS public.implantacao_categorias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  implantacao_id uuid NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  template_id uuid,
  nome text NOT NULL,
  icone text DEFAULT 'task_alt',
  cor text DEFAULT '#0F7173',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantacao_categorias TO authenticated;
GRANT ALL ON public.implantacao_categorias TO service_role;
ALTER TABLE public.implantacao_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê categorias" ON public.implantacao_categorias FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insere categorias" ON public.implantacao_categorias FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza categorias" ON public.implantacao_categorias FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff deleta categorias" ON public.implantacao_categorias FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX idx_impl_cat_implantacao ON public.implantacao_categorias(implantacao_id, ordem);

CREATE TRIGGER trg_impl_cat_updated BEFORE UPDATE ON public.implantacao_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.implantacao_tarefas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id uuid NOT NULL REFERENCES public.implantacao_categorias(id) ON DELETE CASCADE,
  implantacao_id uuid NOT NULL REFERENCES public.implantacoes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'pendente',
  responsavel_email text,
  responsavel_nome text,
  prazo date,
  concluido_em timestamptz,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantacao_tarefas TO authenticated;
GRANT ALL ON public.implantacao_tarefas TO service_role;
ALTER TABLE public.implantacao_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê tarefas impl" ON public.implantacao_tarefas FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insere tarefas impl" ON public.implantacao_tarefas FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualiza tarefas impl" ON public.implantacao_tarefas FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff deleta tarefas impl" ON public.implantacao_tarefas FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX idx_impl_tar_categoria ON public.implantacao_tarefas(categoria_id, ordem);
CREATE INDEX idx_impl_tar_implantacao ON public.implantacao_tarefas(implantacao_id);

CREATE TRIGGER trg_impl_tar_updated BEFORE UPDATE ON public.implantacao_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migração: agrupar checklist_items por etapa (cast enum -> text)
DO $$
DECLARE
  rec RECORD;
  cat_id uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT implantacao_id, COALESCE(NULLIF(etapa::text, ''), 'geral') AS etapa_txt
    FROM public.checklist_items
    WHERE implantacao_id IS NOT NULL
  LOOP
    INSERT INTO public.implantacao_categorias (implantacao_id, nome, icone, ordem)
    VALUES (
      rec.implantacao_id,
      CASE rec.etapa_txt
        WHEN 'novo_cliente' THEN 'Novo Cliente'
        WHEN 'boas_vindas' THEN 'Boas-vindas'
        WHEN 'treinamento_1' THEN 'Treinamento 1'
        WHEN 'treinamento_2' THEN 'Treinamento 2'
        WHEN 'treinamento_3' THEN 'Treinamento 3'
        WHEN 'finalizado' THEN 'Pós Go-Live'
        WHEN 'geral' THEN 'Checklist Geral'
        ELSE initcap(replace(rec.etapa_txt, '_', ' '))
      END,
      'task_alt',
      CASE rec.etapa_txt
        WHEN 'novo_cliente' THEN 0
        WHEN 'boas_vindas' THEN 1
        WHEN 'treinamento_1' THEN 2
        WHEN 'treinamento_2' THEN 3
        WHEN 'treinamento_3' THEN 4
        WHEN 'finalizado' THEN 5
        ELSE 99
      END
    )
    RETURNING id INTO cat_id;

    INSERT INTO public.implantacao_tarefas (
      categoria_id, implantacao_id, titulo, status, ordem, created_at, concluido_em
    )
    SELECT
      cat_id,
      ci.implantacao_id,
      ci.label,
      CASE WHEN ci.concluido THEN 'concluido' ELSE 'pendente' END,
      COALESCE(ci.ordem, 0),
      COALESCE(ci.created_at, now()),
      CASE WHEN ci.concluido THEN COALESCE(ci.updated_at, now()) ELSE NULL END
    FROM public.checklist_items ci
    WHERE ci.implantacao_id = rec.implantacao_id
      AND COALESCE(ci.etapa::text, 'geral') = rec.etapa_txt;
  END LOOP;
END $$;