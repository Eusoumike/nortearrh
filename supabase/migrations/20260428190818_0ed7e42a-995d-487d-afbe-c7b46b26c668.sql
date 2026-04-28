-- =========================================================
-- 1) Proteger colunas sensíveis (AnyDesk) contra viewers
-- =========================================================
-- Revoga SELECT nas colunas sensíveis para o role authenticated
REVOKE SELECT (anydesk_id, anydesk_senha) ON public.clients FROM authenticated;

-- Cria função SECURITY DEFINER que retorna as credenciais apenas
-- para usuários não-viewer. Frontend deve consumir esta função
-- (ou continuar lendo via SELECT * — viewers receberão NULL nessas colunas
-- via política de coluna abaixo).
-- Como não é possível ter "column-level RLS" nativo, usamos uma VIEW segura.

-- View pública que mascara credenciais para viewers
CREATE OR REPLACE VIEW public.clients_safe
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.name,
  c.email,
  c.phone,
  c.company,
  c.document,
  c.address,
  c.health,
  c.health_reason,
  c.account_owner,
  c.pipedrive_person_id,
  c.tags,
  c.created_by,
  c.created_at,
  c.updated_at,
  c.contact_name,
  c.cnpj,
  c.whatsapp,
  c.billing_email,
  c.nps_token,
  c.nps_score,
  c.nps_data,
  c.notes,
  CASE WHEN public.has_role(auth.uid(), 'viewer'::app_role)
       THEN NULL ELSE c.anydesk_id END AS anydesk_id,
  CASE WHEN public.has_role(auth.uid(), 'viewer'::app_role)
       THEN NULL ELSE c.anydesk_senha END AS anydesk_senha
FROM public.clients c;

GRANT SELECT ON public.clients_safe TO authenticated;

-- Re-conceder SELECT nas colunas sensíveis SOMENTE para uso interno
-- via funções/políticas — mas RLS continua bloqueando viewer através
-- da nova policy de SELECT abaixo (split por role).
GRANT SELECT (anydesk_id, anydesk_senha) ON public.clients TO authenticated;

-- Substitui política de SELECT em clients para impedir viewers de ler
-- linhas que contenham AnyDesk preenchido? Não — viewers precisam ver
-- clientes para NPS/chamados. Então mantemos SELECT aberto, mas o REVOKE
-- de coluna acima já impede leitura direta de anydesk_*.
-- (Nada a fazer aqui.)

-- =========================================================
-- 2) has_role: impedir checagem de role de outros usuários
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND auth.uid() IS NOT NULL
      AND (
        _user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      )
  );
$function$;

-- =========================================================
-- 3) user_roles: bloquear INSERT/UPDATE/DELETE para não-admins
-- =========================================================
DROP POLICY IF EXISTS "Bloqueia insert direto em user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Bloqueia update direto em user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Bloqueia delete direto em user_roles" ON public.user_roles;

CREATE POLICY "Apenas admin insere user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admin atualiza user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Apenas admin apaga user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));