-- Restringir leitura de DEALS: viewer bloqueado
DROP POLICY IF EXISTS "Lê negócios" ON public.deals;
CREATE POLICY "Lê negócios"
ON public.deals
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
);

-- Restringir leitura de MESSAGE_TEMPLATES: viewer bloqueado
DROP POLICY IF EXISTS "Lê templates" ON public.message_templates;
CREATE POLICY "Lê templates"
ON public.message_templates
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
);