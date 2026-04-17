DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_created_by_fkey') THEN
    ALTER TABLE public.tickets ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_client_id_fkey') THEN
    ALTER TABLE public.tickets ADD CONSTRAINT tickets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_assigned_to_fkey') THEN
    ALTER TABLE public.tickets ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_interactions_author_id_fkey') THEN
    ALTER TABLE public.ticket_interactions ADD CONSTRAINT ticket_interactions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_interactions_ticket_id_fkey') THEN
    ALTER TABLE public.ticket_interactions ADD CONSTRAINT ticket_interactions_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_status_history_ticket_id_fkey') THEN
    ALTER TABLE public.ticket_status_history ADD CONSTRAINT ticket_status_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_status_history_changed_by_fkey') THEN
    ALTER TABLE public.ticket_status_history ADD CONSTRAINT ticket_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_account_owner_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_account_owner_fkey FOREIGN KEY (account_owner) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_created_by_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_interactions_ticket_id ON public.ticket_interactions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_interactions_author_id ON public.ticket_interactions(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket_id ON public.ticket_status_history(ticket_id);

NOTIFY pgrst, 'reload schema';