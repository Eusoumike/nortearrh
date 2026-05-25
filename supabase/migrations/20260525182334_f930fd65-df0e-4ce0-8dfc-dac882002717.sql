DROP TABLE IF EXISTS public.deal_history CASCADE;
DROP TABLE IF EXISTS public.deal_contacts CASCADE;
DROP TABLE IF EXISTS public.deal_activities CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.crm_activities CASCADE;
DROP TABLE IF EXISTS public.crm_contacts CASCADE;
DROP TABLE IF EXISTS public.crm_deals CASCADE;
DROP TABLE IF EXISTS public.crm_metas CASCADE;
DROP TABLE IF EXISTS public.crm_cnpj_consultas CASCADE;
DROP TABLE IF EXISTS public.crm_stages CASCADE;
DROP FUNCTION IF EXISTS public.handle_deal_stage_change() CASCADE;

DO $$
DECLARE
  tabela text;
BEGIN
  FOR tabela IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'crm_%'
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(tabela) || ' CASCADE';
  END LOOP;
END $$;