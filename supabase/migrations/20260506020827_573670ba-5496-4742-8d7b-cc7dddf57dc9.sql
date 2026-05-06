
-- 1. Add color and is_system to custom_ticket_stages
ALTER TABLE public.custom_ticket_stages
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#94a3b8',
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2. Add kanban_stage_key to tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS kanban_stage_key text;

-- 3. Seed system stages (6 padrão) — only if not present
INSERT INTO public.custom_ticket_stages (stage_key, label, color, ordem, sla_hours, is_system, ativo)
VALUES
  ('novo',                'Novo',                '#3b82f6', 0,  8, true, true),
  ('em_atendimento',      'Em Atendimento',      '#f59e0b', 1,  4, true, true),
  ('aguardando_cliente',  'Aguardando Cliente',  '#94a3b8', 2, 24, true, true),
  ('suporte_vera_n1',     'Suporte Vera N1',     '#a855f7', 3,  8, true, true),
  ('abertura_chamado_n2', 'Abertura Chamado N2', '#ef4444', 4, 24, true, true),
  ('resolvido',           'Resolvido',           '#10b981', 5,  0, true, true)
ON CONFLICT (stage_key) DO UPDATE
  SET is_system = EXCLUDED.is_system,
      label = COALESCE(public.custom_ticket_stages.label, EXCLUDED.label);

-- Ensure stage_key uniqueness for ON CONFLICT to work
CREATE UNIQUE INDEX IF NOT EXISTS custom_ticket_stages_stage_key_uidx ON public.custom_ticket_stages(stage_key);

-- 4. Backfill kanban_stage_key on existing tickets with their current status
UPDATE public.tickets
   SET kanban_stage_key = CASE WHEN status::text = 'fechado' THEN 'resolvido' ELSE status::text END
 WHERE kanban_stage_key IS NULL;

-- 5. Trigger: when status changes on tickets, sync kanban_stage_key to status (system stages)
CREATE OR REPLACE FUNCTION public.sync_kanban_stage_on_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.kanban_stage_key := CASE WHEN NEW.status::text = 'fechado' THEN 'resolvido' ELSE NEW.status::text END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_kanban_stage ON public.tickets;
CREATE TRIGGER trg_sync_kanban_stage
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_kanban_stage_on_status_change();

-- 6. Index for kanban grouping
CREATE INDEX IF NOT EXISTS tickets_kanban_stage_key_idx ON public.tickets(kanban_stage_key);
