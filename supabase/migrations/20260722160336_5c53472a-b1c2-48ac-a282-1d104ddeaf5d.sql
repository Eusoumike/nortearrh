CREATE TABLE IF NOT EXISTS public._backup_nps_responses AS SELECT * FROM public.nps_responses;
DROP TABLE IF EXISTS public.nps_responses CASCADE;
ALTER TABLE public.clients DROP COLUMN IF EXISTS nps_token;