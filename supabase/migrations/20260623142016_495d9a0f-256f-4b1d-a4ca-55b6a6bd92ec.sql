
-- Enum para status da etapa
DO $$ BEGIN
  CREATE TYPE public.etapa_status AS ENUM ('pendente', 'em_andamento', 'concluida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal de etapas
CREATE TABLE public.ticket_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_inicio timestamptz,
  data_conclusao timestamptz,
  prazo timestamptz,
  status public.etapa_status NOT NULL DEFAULT 'pendente',
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_etapas_ticket_idx ON public.ticket_etapas(ticket_id, ordem);
CREATE INDEX ticket_etapas_responsavel_idx ON public.ticket_etapas(responsavel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_etapas TO authenticated;
GRANT ALL ON public.ticket_etapas TO service_role;

ALTER TABLE public.ticket_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff e viewer podem ver etapas"
  ON public.ticket_etapas FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'viewer')
  );

CREATE POLICY "Admin e manager criam etapas"
  ON public.ticket_etapas FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admin, manager ou responsavel atualizam"
  ON public.ticket_etapas FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR responsavel_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR responsavel_id = auth.uid()
  );

CREATE POLICY "Admin e manager excluem etapas"
  ON public.ticket_etapas FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Trigger updated_at + auto preenchimento de datas conforme status
CREATE OR REPLACE FUNCTION public.handle_ticket_etapa_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'em_andamento' AND NEW.data_inicio IS NULL THEN
    NEW.data_inicio := now();
  END IF;
  IF NEW.status = 'concluida' AND NEW.data_conclusao IS NULL THEN
    NEW.data_conclusao := now();
    IF NEW.data_inicio IS NULL THEN NEW.data_inicio := now(); END IF;
  END IF;
  IF NEW.status <> 'concluida' THEN
    NEW.data_conclusao := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ticket_etapa_dates
  BEFORE INSERT OR UPDATE ON public.ticket_etapas
  FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_etapa_dates();

-- Histórico
CREATE TABLE public.ticket_etapa_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid,
  ticket_id uuid NOT NULL,
  acao text NOT NULL,
  user_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_etapa_historico_ticket_idx ON public.ticket_etapa_historico(ticket_id, created_at DESC);

GRANT SELECT, INSERT ON public.ticket_etapa_historico TO authenticated;
GRANT ALL ON public.ticket_etapa_historico TO service_role;

ALTER TABLE public.ticket_etapa_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff e viewer podem ver historico"
  ON public.ticket_etapa_historico FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'viewer')
  );

CREATE POLICY "Sistema grava historico"
  ON public.ticket_etapa_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_ticket_etapa_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acao text;
  v_payload jsonb;
  v_etapa_id uuid;
  v_ticket_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criada';
    v_etapa_id := NEW.id;
    v_ticket_id := NEW.ticket_id;
    v_payload := jsonb_build_object('nome', NEW.nome, 'status', NEW.status, 'responsavel_id', NEW.responsavel_id);
  ELSIF TG_OP = 'UPDATE' THEN
    v_etapa_id := NEW.id;
    v_ticket_id := NEW.ticket_id;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluida' THEN
      v_acao := 'concluida';
    ELSE
      v_acao := 'editada';
    END IF;
    v_payload := jsonb_build_object(
      'antes', jsonb_build_object('nome', OLD.nome, 'status', OLD.status, 'responsavel_id', OLD.responsavel_id, 'prazo', OLD.prazo),
      'depois', jsonb_build_object('nome', NEW.nome, 'status', NEW.status, 'responsavel_id', NEW.responsavel_id, 'prazo', NEW.prazo)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluida';
    v_etapa_id := OLD.id;
    v_ticket_id := OLD.ticket_id;
    v_payload := jsonb_build_object('nome', OLD.nome, 'status', OLD.status);
  END IF;

  INSERT INTO public.ticket_etapa_historico (etapa_id, ticket_id, acao, user_id, payload)
  VALUES (v_etapa_id, v_ticket_id, v_acao, auth.uid(), v_payload);

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_log_ticket_etapa
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_etapas
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_etapa_change();
