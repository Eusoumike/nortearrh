-- Clean orphan rows before adding FKs
DELETE FROM public.checklist_items WHERE implantacao_id NOT IN (SELECT id FROM public.implantacoes);
DELETE FROM public.implantacao_eventos WHERE implantacao_id NOT IN (SELECT id FROM public.implantacoes);
DELETE FROM public.implantacao_pendencias WHERE implantacao_id NOT IN (SELECT id FROM public.implantacoes);
UPDATE public.tickets SET client_id = NULL WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients);
DELETE FROM public.ticket_interactions WHERE ticket_id NOT IN (SELECT id FROM public.tickets);
UPDATE public.tasks SET ticket_id = NULL WHERE ticket_id IS NOT NULL AND ticket_id NOT IN (SELECT id FROM public.tickets);
UPDATE public.tasks SET client_id = NULL WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients);

-- Add foreign keys idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_checklist_implantacao') THEN
    ALTER TABLE public.checklist_items
      ADD CONSTRAINT fk_checklist_implantacao
      FOREIGN KEY (implantacao_id) REFERENCES public.implantacoes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_eventos_implantacao') THEN
    ALTER TABLE public.implantacao_eventos
      ADD CONSTRAINT fk_eventos_implantacao
      FOREIGN KEY (implantacao_id) REFERENCES public.implantacoes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pendencias_implantacao') THEN
    ALTER TABLE public.implantacao_pendencias
      ADD CONSTRAINT fk_pendencias_implantacao
      FOREIGN KEY (implantacao_id) REFERENCES public.implantacoes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_client') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT fk_tickets_client
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_interactions_ticket') THEN
    ALTER TABLE public.ticket_interactions
      ADD CONSTRAINT fk_interactions_ticket
      FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_ticket') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_ticket
      FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_client') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_client
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes on FK columns
CREATE INDEX IF NOT EXISTS idx_checklist_items_implantacao_id ON public.checklist_items(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_implantacao_eventos_implantacao_id ON public.implantacao_eventos(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_implantacao_pendencias_implantacao_id ON public.implantacao_pendencias(implantacao_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_ticket_interactions_ticket_id ON public.ticket_interactions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_ticket_id ON public.tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);