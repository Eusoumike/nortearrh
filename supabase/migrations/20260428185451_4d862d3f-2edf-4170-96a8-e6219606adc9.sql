-- Remove políticas conflitantes de INSERT em nps_responses
DROP POLICY IF EXISTS "Envio público de NPS" ON public.nps_responses;
DROP POLICY IF EXISTS "Envia resposta NPS com token válido" ON public.nps_responses;
DROP POLICY IF EXISTS "Allow public NPS submissions" ON public.nps_responses;

-- Política única: qualquer pessoa pode enviar resposta no formulário público
CREATE POLICY "Allow public NPS submissions"
ON public.nps_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);