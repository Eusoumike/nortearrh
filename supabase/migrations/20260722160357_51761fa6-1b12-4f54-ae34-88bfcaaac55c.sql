ALTER TABLE public._backup_nps_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._backup_nps_responses FROM anon, authenticated;