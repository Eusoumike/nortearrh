
-- 1. Tabela de etapas customizadas (definições globais)
CREATE TABLE public.custom_ticket_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key text NOT NULL UNIQUE,
  label text NOT NULL,
  sla_hours numeric NOT NULL DEFAULT 8,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_ticket_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê etapas customizadas" ON public.custom_ticket_stages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/manager cria etapas customizadas" ON public.custom_ticket_stages
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/manager atualiza etapas customizadas" ON public.custom_ticket_stages
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admin/manager apaga etapas customizadas" ON public.custom_ticket_stages
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_custom_ticket_stages_updated
  BEFORE UPDATE ON public.custom_ticket_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de acumulado de tempo por ticket × etapa customizada
CREATE TABLE public.ticket_stage_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  stage_key text NOT NULL,
  total_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, stage_key)
);

CREATE INDEX idx_ticket_stage_times_ticket ON public.ticket_stage_times(ticket_id);

ALTER TABLE public.ticket_stage_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê tempos de etapa" ON public.ticket_stage_times
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema/usuário grava tempos de etapa" ON public.ticket_stage_times
  FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Sistema/usuário atualiza tempos de etapa" ON public.ticket_stage_times
  FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admin apaga tempos de etapa" ON public.ticket_stage_times
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Colunas no tickets para rastrear etapa customizada ativa
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS active_custom_stage_key text,
  ADD COLUMN IF NOT EXISTS custom_stage_started_at timestamptz;

-- 4. Trigger que acumula tempo da etapa customizada anterior
CREATE OR REPLACE FUNCTION public.handle_ticket_custom_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_key text;
  prev_started timestamptz;
  delta_sec integer;
  custom_changed boolean;
  status_changed boolean;
BEGIN
  custom_changed := COALESCE(NEW.active_custom_stage_key, '') IS DISTINCT FROM COALESCE(OLD.active_custom_stage_key, '');
  status_changed := NEW.status IS DISTINCT FROM OLD.status;

  -- Se mudou o status enum, força encerrar etapa customizada ativa
  IF status_changed AND OLD.active_custom_stage_key IS NOT NULL THEN
    custom_changed := true;
    NEW.active_custom_stage_key := NULL;
    NEW.custom_stage_started_at := NULL;
  END IF;

  IF NOT custom_changed THEN
    RETURN NEW;
  END IF;

  prev_key := OLD.active_custom_stage_key;
  prev_started := OLD.custom_stage_started_at;

  -- Acumula tempo da etapa anterior
  IF prev_key IS NOT NULL AND prev_started IS NOT NULL THEN
    delta_sec := GREATEST(0, EXTRACT(EPOCH FROM (now() - prev_started))::integer);
    INSERT INTO public.ticket_stage_times (ticket_id, stage_key, total_seconds)
    VALUES (NEW.id, prev_key, delta_sec)
    ON CONFLICT (ticket_id, stage_key) DO UPDATE
      SET total_seconds = public.ticket_stage_times.total_seconds + EXCLUDED.total_seconds,
          updated_at = now();
  END IF;

  -- Inicia cronômetro da nova etapa customizada
  IF NEW.active_custom_stage_key IS NOT NULL THEN
    NEW.custom_stage_started_at := now();
  ELSE
    NEW.custom_stage_started_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_custom_stage_change ON public.tickets;
CREATE TRIGGER trg_ticket_custom_stage_change
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_custom_stage_change();
