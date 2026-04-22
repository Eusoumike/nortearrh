
-- Tabela de configurações do sistema (singleton — id fixo)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_api_token text,
  pipedrive_user_name text,
  pipedrive_connected_at timestamptz,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver/alterar (token sensível)
CREATE POLICY "Admins veem system_settings"
  ON public.system_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins inserem system_settings"
  ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins atualizam system_settings"
  ON public.system_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins apagam system_settings"
  ON public.system_settings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de preferências do usuário
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY,
  theme text NOT NULL DEFAULT 'light',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê próprias preferências"
  ON public.user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário cria próprias preferências"
  ON public.user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza próprias preferências"
  ON public.user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para admin alterar role de outro usuário
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target_user uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar papéis';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, _role);
END;
$$;

-- Função para admin remover usuário (apaga roles; auth.users requer service_role)
CREATE OR REPLACE FUNCTION public.admin_remove_user_access(_target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem remover acessos';
  END IF;
  IF _target_user = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio acesso';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user;
END;
$$;
