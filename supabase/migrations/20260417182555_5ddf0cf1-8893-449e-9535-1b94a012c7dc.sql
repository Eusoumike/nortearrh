ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_created_by_fkey;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_client_id_fkey;
ALTER TABLE public.ticket_interactions DROP CONSTRAINT IF EXISTS ticket_interactions_author_id_fkey;
ALTER TABLE public.ticket_interactions DROP CONSTRAINT IF EXISTS ticket_interactions_ticket_id_fkey;
ALTER TABLE public.ticket_status_history DROP CONSTRAINT IF EXISTS ticket_status_history_ticket_id_fkey;
ALTER TABLE public.ticket_status_history DROP CONSTRAINT IF EXISTS ticket_status_history_changed_by_fkey;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_account_owner_fkey;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_created_by_fkey;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT tickets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.ticket_interactions
  ADD CONSTRAINT ticket_interactions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_interactions_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_status_history
  ADD CONSTRAINT ticket_status_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT ticket_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_account_owner_fkey FOREIGN KEY (account_owner) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';