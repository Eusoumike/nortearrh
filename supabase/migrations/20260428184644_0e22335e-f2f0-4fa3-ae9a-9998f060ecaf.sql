-- Allow public/anonymous NPS form submissions (no token required)
CREATE POLICY "Envio público de NPS"
ON public.nps_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (client_id IS NULL);