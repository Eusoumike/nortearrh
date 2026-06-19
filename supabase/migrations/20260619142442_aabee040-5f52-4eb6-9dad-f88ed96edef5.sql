ALTER TABLE public.implantacao_templates 
  ADD COLUMN IF NOT EXISTS produto text NOT NULL DEFAULT 'ambos',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_impl_templates_default ON public.implantacao_templates(produto, is_default);