REVOKE EXECUTE ON FUNCTION public.atualizar_health_implantacoes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_parcela_enquanto_ativo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagar_dados_cliente() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_first_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_ticket_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_ticket_custom_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagar_cnpj_cliente() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_client_nps() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_cnpj_from_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_parcelas_rh_on_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_client_nps_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas_rh() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_repasses_rh_on_pagamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_repasses_vr_primeira_carga() FROM PUBLIC, anon, authenticated;