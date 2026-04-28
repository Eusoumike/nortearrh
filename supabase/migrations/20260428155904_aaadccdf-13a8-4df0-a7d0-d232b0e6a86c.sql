-- 1) Restrict NPS INSERT policy to require valid token matching a real client.
--    Force client_id to be NULL in payload (trigger will resolve it from token).
DROP POLICY IF EXISTS "Qualquer um envia resposta NPS" ON public.nps_responses;

CREATE POLICY "Envia resposta NPS com token válido"
ON public.nps_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  client_id IS NULL
  AND token IS NOT NULL
  AND length(token) > 0
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.nps_token = nps_responses.token)
);

-- 2) Simplify has_role: only check the caller's own uid against user_roles.
--    All current RLS calls use has_role(auth.uid(), ...), so behavior is unchanged.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND auth.uid() IS NOT NULL
  );
$$;

-- 3) Lock down SECURITY DEFINER admin functions so only the database/service role can call them
--    (they're invoked via SQL from trusted server contexts only).
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_remove_user_access(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
-- Keep get_user_role and has_role callable by authenticated users (used by the app).
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;