-- CRM tables
DROP TABLE IF EXISTS public.crm_activities CASCADE;
DROP TABLE IF EXISTS public.crm_contacts CASCADE;
DROP TABLE IF EXISTS public.crm_deals CASCADE;
DROP TABLE IF EXISTS public.crm_metas CASCADE;
DROP TABLE IF EXISTS public.crm_cnpj_consultas CASCADE;
DROP TABLE IF EXISTS public.crm_stages CASCADE;
DROP TABLE IF EXISTS public.deal_activities CASCADE;
DROP TABLE IF EXISTS public.deal_contacts CASCADE;
DROP TABLE IF EXISTS public.deal_history CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;

-- NPS tables
DROP TABLE IF EXISTS public.nps_responses CASCADE;
DROP TABLE IF EXISTS public.nps_ratings CASCADE;
DROP TABLE IF EXISTS public.avaliacoes CASCADE;

-- Assist
DROP TABLE IF EXISTS public.assist_conversations CASCADE;
DROP TABLE IF EXISTS public.assist_solutions CASCADE;

-- Pipedrive
DROP TABLE IF EXISTS public.pipedrive_clients CASCADE;
DROP TABLE IF EXISTS public.pipedrive_sync_log CASCADE;

-- Drop dependent view before removing columns
DROP VIEW IF EXISTS public.clients_safe CASCADE;

-- Pipedrive + NPS columns on clients
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS pipedrive_id,
  DROP COLUMN IF EXISTS pipedrive_person_id,
  DROP COLUMN IF EXISTS pipedrive_org_id,
  DROP COLUMN IF EXISTS nps_score,
  DROP COLUMN IF EXISTS nps_data,
  DROP COLUMN IF EXISTS nps_token;

-- Pipedrive columns on system_settings
ALTER TABLE public.system_settings
  DROP COLUMN IF EXISTS pipedrive_api_token,
  DROP COLUMN IF EXISTS pipedrive_user_name,
  DROP COLUMN IF EXISTS pipedrive_connected_at;