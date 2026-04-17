-- 9 colunas novas para timers por etapa
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS entered_em_atendimento_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_em_atendimento_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entered_aguardando_cliente_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_aguardando_cliente_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entered_vera_n1_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_vera_n1_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entered_n2_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_n2_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_stage_started_at timestamptz NOT NULL DEFAULT now();

-- Backfill
UPDATE public.tickets SET current_stage_started_at = status_changed_at;
UPDATE public.tickets SET entered_em_atendimento_at = status_changed_at WHERE status = 'em_atendimento' AND entered_em_atendimento_at IS NULL;
UPDATE public.tickets SET entered_aguardando_cliente_at = status_changed_at WHERE status = 'aguardando_cliente' AND entered_aguardando_cliente_at IS NULL;
UPDATE public.tickets SET entered_vera_n1_at = status_changed_at WHERE status = 'suporte_vera_n1' AND entered_vera_n1_at IS NULL;
UPDATE public.tickets SET entered_n2_at = status_changed_at WHERE status = 'abertura_chamado_n2' AND entered_n2_at IS NULL;

-- Atualizar trigger
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
    ELSIF NEW.status = 'aguardando_cliente' THEN
      NEW.entered_aguardando_cliente_at := now();
    ELSIF NEW.status = 'suporte_vera_n1' THEN
      NEW.entered_vera_n1_at := now();
    ELSIF NEW.status = 'abertura_chamado_n2' THEN
      NEW.entered_n2_at := now();
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

DROP TRIGGER IF EXISTS trg_ticket_status_change ON public.tickets;
CREATE TRIGGER trg_ticket_status_change
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_status_change();