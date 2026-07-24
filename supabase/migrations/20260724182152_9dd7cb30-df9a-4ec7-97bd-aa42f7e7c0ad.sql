
-- Bucket privado para backups (criado via SQL não permitido; usar tool depois)
-- Aqui: tabela de log + cron

CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'automatico', -- automatico | manual
  status text NOT NULL, -- sucesso | erro | parcial
  total_tabelas integer,
  total_linhas integer,
  tamanho_bytes bigint,
  storage_path text,
  signed_url text,
  signed_url_expira_em timestamptz,
  email_enviado boolean NOT NULL DEFAULT false,
  email_destinatario text,
  email_erro text,
  detalhes jsonb,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup logs"
  ON public.backup_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Extensões para agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
