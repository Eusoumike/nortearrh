-- 1) Mover pg_trgm para schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;
-- Remove o índice que depende do operador, recria depois
DROP INDEX IF EXISTS public.idx_clients_name_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
CREATE INDEX idx_clients_name_trgm ON public.clients USING gin (name extensions.gin_trgm_ops);

-- 2) Remover INSERT policy permissiva em ticket_status_history
-- A inserção acontece apenas via trigger handle_ticket_status_change (SECURITY DEFINER),
-- que bypass RLS. Sem policy = sem inserts diretos do client.
DROP POLICY IF EXISTS "Insere histórico" ON public.ticket_status_history;