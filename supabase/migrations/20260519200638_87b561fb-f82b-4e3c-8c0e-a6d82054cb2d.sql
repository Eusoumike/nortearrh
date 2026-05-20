ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS descricao_problema text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS quem_reportou text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS acao_tentada text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ja_tentou text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS solucao_aplicada text;