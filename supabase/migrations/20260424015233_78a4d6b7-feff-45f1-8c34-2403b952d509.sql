ALTER TABLE public.implantacoes
  ADD COLUMN IF NOT EXISTS metodo_registro text,
  ADD COLUMN IF NOT EXISTS metodo_registro_obs text;