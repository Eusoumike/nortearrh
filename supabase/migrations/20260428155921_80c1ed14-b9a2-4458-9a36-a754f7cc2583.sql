REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_first_response() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_ticket_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_client_nps() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_client_nps_score() FROM anon, authenticated, public;