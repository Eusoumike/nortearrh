-- Enable extensions for scheduled jobs and HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enum: ticket type (P1)
DO $$ BEGIN
  CREATE TYPE public.ticket_type AS ENUM (
    'duvida_uso',
    'configuracao',
    'fechamento',
    'admissao_demissao',
    'bug_sistema',
    'produto_rh_digital',
    'beneficios_vr',
    'upgrade',
    'downgrade',
    'financeiro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum: interaction result (P2)
DO $$ BEGIN
  CREATE TYPE public.interaction_result AS ENUM (
    'resolvido',
    'parcialmente_resolvido',
    'escalado',
    'aguardando'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tickets: add ticket_type + sla_alert_sent
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_type public.ticket_type,
  ADD COLUMN IF NOT EXISTS sla_alert_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON public.tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_alert ON public.tickets(sla_alert_sent) WHERE sla_alert_sent = false;
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets(client_id);

-- Ticket interactions: structured P2 fields
ALTER TABLE public.ticket_interactions
  ADD COLUMN IF NOT EXISTS problem_description text,
  ADD COLUMN IF NOT EXISTS solution_applied text,
  ADD COLUMN IF NOT EXISTS result public.interaction_result,
  ADD COLUMN IF NOT EXISTS channel public.ticket_channel,
  ADD COLUMN IF NOT EXISTS interaction_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS time_spent_minutes integer;

-- Make summary nullable so the new structured form can omit it (we'll auto-fill it for back-compat)
ALTER TABLE public.ticket_interactions ALTER COLUMN summary DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_interactions_ticket_id ON public.ticket_interactions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_interactions_interaction_at ON public.ticket_interactions(interaction_at DESC);