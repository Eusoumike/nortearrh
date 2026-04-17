-- Habilitar extensões primeiro
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent', 'viewer');
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado');
CREATE TYPE public.ticket_priority AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.ticket_channel AS ENUM ('email', 'whatsapp', 'telefone', 'chat', 'portal', 'pipedrive', 'outro');
CREATE TYPE public.interaction_type AS ENUM ('nota', 'email', 'ligacao', 'whatsapp', 'reuniao', 'mudanca_status');
CREATE TYPE public.client_health AS ENUM ('saudavel', 'em_atencao', 'critico');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  job_title TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles visíveis para autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Atualiza próprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Insere próprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'agent' THEN 3 WHEN 'viewer' THEN 4 END
  LIMIT 1
$$;

CREATE POLICY "Vê próprias roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- handle_new_user (precisa existir user_roles antes)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  IF (SELECT COUNT(*) FROM public.profiles) = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  document TEXT,
  address TEXT,
  notes TEXT,
  health client_health NOT NULL DEFAULT 'saudavel',
  health_reason TEXT,
  account_owner UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pipedrive_person_id TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_health ON public.clients(health);
CREATE INDEX idx_clients_owner ON public.clients(account_owner);
CREATE INDEX idx_clients_name_trgm ON public.clients USING gin (name gin_trgm_ops);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lê clientes" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cria clientes" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Atualiza clientes" ON public.clients FOR UPDATE TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Apaga clientes" ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status ticket_status NOT NULL DEFAULT 'aberto',
  priority ticket_priority NOT NULL DEFAULT 'media',
  channel ticket_channel NOT NULL DEFAULT 'portal',
  category TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_response_deadline TIMESTAMPTZ,
  sla_resolution_deadline TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_active_seconds INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  pipedrive_deal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_priority ON public.tickets(priority);
CREATE INDEX idx_tickets_assigned ON public.tickets(assigned_to);
CREATE INDEX idx_tickets_client ON public.tickets(client_id);
CREATE INDEX idx_tickets_created ON public.tickets(created_at DESC);
CREATE INDEX idx_tickets_sla_resolution ON public.tickets(sla_resolution_deadline) WHERE status NOT IN ('resolvido', 'fechado');

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lê tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cria tickets" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Atualiza tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Apaga tickets" ON public.tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ticket_interactions
CREATE TABLE public.ticket_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  type interaction_type NOT NULL DEFAULT 'nota',
  summary TEXT NOT NULL,
  content TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interactions_ticket ON public.ticket_interactions(ticket_id, created_at DESC);
ALTER TABLE public.ticket_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lê interações" ON public.ticket_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cria interações" ON public.ticket_interactions FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'viewer') AND auth.uid() = author_id);
CREATE POLICY "Edita própria interação" ON public.ticket_interactions FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);
CREATE POLICY "Apaga interação" ON public.ticket_interactions FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- ticket_status_history
CREATE TABLE public.ticket_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_status ticket_status,
  to_status ticket_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_ticket ON public.ticket_status_history(ticket_id, created_at DESC);
ALTER TABLE public.ticket_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lê histórico" ON public.ticket_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insere histórico" ON public.ticket_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- Triggers de status e primeira resposta
CREATE OR REPLACE FUNCTION public.handle_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
  duration_sec INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    duration_sec := EXTRACT(EPOCH FROM (now() - OLD.status_changed_at))::INTEGER;
    INSERT INTO public.ticket_status_history (ticket_id, from_status, to_status, changed_by, duration_seconds)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), duration_sec);
    NEW.status_changed_at := now();
    IF OLD.status IN ('aberto', 'em_andamento') THEN
      NEW.total_active_seconds := COALESCE(OLD.total_active_seconds, 0) + duration_sec;
    END IF;
    IF NEW.status = 'resolvido' AND OLD.status <> 'resolvido' THEN
      NEW.resolved_at := now();
    END IF;
    IF NEW.status = 'fechado' AND OLD.status <> 'fechado' THEN
      NEW.closed_at := COALESCE(NEW.closed_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_ticket_status_change
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_status_change();

CREATE OR REPLACE FUNCTION public.handle_first_response()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tickets
  SET first_response_at = now()
  WHERE id = NEW.ticket_id
    AND first_response_at IS NULL
    AND NEW.is_internal = false
    AND NEW.author_id <> created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_first_response
  AFTER INSERT ON public.ticket_interactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_first_response();