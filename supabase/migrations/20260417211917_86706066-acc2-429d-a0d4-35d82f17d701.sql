-- 1) Adicionar valores aos enums (precisa ser commit separado, mas Postgres permite no mesmo migration desde v12)
ALTER TYPE public.ticket_channel ADD VALUE IF NOT EXISTS 'reuniao';
ALTER TYPE public.ticket_channel ADD VALUE IF NOT EXISTS 'anydesk';
ALTER TYPE public.ticket_priority ADD VALUE IF NOT EXISTS 'urgente';

-- 2) Novas colunas em tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS anydesk_id text,
  ADD COLUMN IF NOT EXISTS anydesk_password text,
  ADD COLUMN IF NOT EXISTS assigned_name text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sla_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS status_ativo_key text,
  ADD COLUMN IF NOT EXISTS status_ativo_desde timestamptz;

-- 3) Atualizar trigger de mudança de status para popular status_ativo_*
CREATE OR REPLACE FUNCTION public.handle_ticket_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  duration_sec INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    duration_sec := EXTRACT(EPOCH FROM (now() - OLD.status_changed_at))::INTEGER;

    INSERT INTO public.ticket_status_history (ticket_id, from_status, to_status, changed_by, duration_seconds)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), duration_sec);

    NEW.status_changed_at := now();
    NEW.current_stage_started_at := now();

    IF OLD.status IN ('novo', 'em_atendimento') THEN
      NEW.total_active_seconds := COALESCE(OLD.total_active_seconds, 0) + duration_sec;
    END IF;

    IF OLD.status = 'em_atendimento' AND OLD.entered_em_atendimento_at IS NOT NULL THEN
      NEW.total_em_atendimento_seconds := COALESCE(OLD.total_em_atendimento_seconds, 0)
        + EXTRACT(EPOCH FROM (now() - OLD.entered_em_atendimento_at))::INTEGER;
      NEW.entered_em_atendimento_at := NULL;
    ELSIF OLD.status = 'aguardando_cliente' AND OLD.entered_aguardando_cliente_at IS NOT NULL THEN
      NEW.total_aguardando_cliente_seconds := COALESCE(OLD.total_aguardando_cliente_seconds, 0)
        + EXTRACT(EPOCH FROM (now() - OLD.entered_aguardando_cliente_at))::INTEGER;
      NEW.entered_aguardando_cliente_at := NULL;
    ELSIF OLD.status = 'suporte_vera_n1' AND OLD.entered_vera_n1_at IS NOT NULL THEN
      NEW.total_vera_n1_seconds := COALESCE(OLD.total_vera_n1_seconds, 0)
        + EXTRACT(EPOCH FROM (now() - OLD.entered_vera_n1_at))::INTEGER;
      NEW.entered_vera_n1_at := NULL;
    ELSIF OLD.status = 'abertura_chamado_n2' AND OLD.entered_n2_at IS NOT NULL THEN
      NEW.total_n2_seconds := COALESCE(OLD.total_n2_seconds, 0)
        + EXTRACT(EPOCH FROM (now() - OLD.entered_n2_at))::INTEGER;
      NEW.entered_n2_at := NULL;
    END IF;

    IF NEW.status = 'em_atendimento' THEN
      NEW.entered_em_atendimento_at := now();
      NEW.status_ativo_key := 'em_atendimento';
      NEW.status_ativo_desde := now();
    ELSIF NEW.status = 'aguardando_cliente' THEN
      NEW.entered_aguardando_cliente_at := now();
      NEW.status_ativo_key := 'aguardando_cliente';
      NEW.status_ativo_desde := now();
    ELSIF NEW.status = 'suporte_vera_n1' THEN
      NEW.entered_vera_n1_at := now();
      NEW.status_ativo_key := 'suporte_vera_n1';
      NEW.status_ativo_desde := now();
    ELSIF NEW.status = 'abertura_chamado_n2' THEN
      NEW.entered_n2_at := now();
      NEW.status_ativo_key := 'abertura_chamado_n2';
      NEW.status_ativo_desde := now();
    ELSE
      -- novo, resolvido, fechado: nenhum timer rodando
      NEW.status_ativo_key := NULL;
      NEW.status_ativo_desde := NULL;
    END IF;

    IF NEW.status = 'resolvido' AND OLD.status <> 'resolvido' THEN
      NEW.resolved_at := now();
    END IF;
    IF NEW.status = 'fechado' AND OLD.status <> 'fechado' THEN
      NEW.closed_at := COALESCE(NEW.closed_at, now());
      IF NEW.resolved_at IS NULL THEN
        NEW.resolved_at := now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Trigger para calcular sla_deadline a partir de opened_at + priority
CREATE OR REPLACE FUNCTION public.compute_ticket_sla_deadline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  hours INTEGER;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.priority IS DISTINCT FROM OLD.priority OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
    hours := CASE NEW.priority
      WHEN 'urgente' THEN 2
      WHEN 'critica' THEN 2
      WHEN 'alta'    THEN 6
      WHEN 'media'   THEN 24
      WHEN 'baixa'   THEN 72
      ELSE 24
    END;
    NEW.sla_deadline := COALESCE(NEW.opened_at, now()) + (hours || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_ticket_sla_deadline ON public.tickets;
CREATE TRIGGER trg_compute_ticket_sla_deadline
BEFORE INSERT OR UPDATE OF priority, opened_at ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.compute_ticket_sla_deadline();

-- 5) Tabela tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','urgente')),
  assigned_to uuid REFERENCES public.profiles(id),
  assigned_name text,
  due_date date,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê tarefas"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Cria tarefas"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Atualiza tarefas"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Apaga tarefas"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR auth.uid() = created_by
  );

CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tasks_ticket_id ON public.tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- 6) Backfill: para tickets existentes que estão num status com timer, popular status_ativo_*
UPDATE public.tickets
SET status_ativo_key = status::text,
    status_ativo_desde = current_stage_started_at
WHERE status IN ('em_atendimento','aguardando_cliente','suporte_vera_n1','abertura_chamado_n2')
  AND status_ativo_key IS NULL;