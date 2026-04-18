-- 1. Drop unused plaintext AnyDesk password column to remove credential exposure
ALTER TABLE public.tickets DROP COLUMN IF EXISTS anydesk_password;

-- 2. Restrict has_role so callers can only check their own role (admins can check anyone)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow callers to check their own role, or admins to check anyone's role.
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF _user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 3. Restrict get_user_role similarly
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF _user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT role INTO result
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'agent' THEN 3
    WHEN 'viewer' THEN 4
  END
  LIMIT 1;

  RETURN result;
END;
$$;