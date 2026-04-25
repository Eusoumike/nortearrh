
-- 1. Tabela nps_responses
CREATE TABLE public.nps_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL,
  empresa text NOT NULL,
  tempo_cliente text,
  frequencia_uso text,
  nota_atendimento integer CHECK (nota_atendimento IS NULL OR (nota_atendimento >= 0 AND nota_atendimento <= 10)),
  atendimento_evolucao text,
  tempo_resposta text,
  confianca_informacoes integer CHECK (confianca_informacoes IS NULL OR (confianca_informacoes >= 0 AND confianca_informacoes <= 10)),
  nps_score integer CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10)),
  feedback_aberto text,
  experiencia_geral text,
  sugestao_melhoria text,
  comentario_adicional text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  token text,
  source text NOT NULL DEFAULT 'formulario',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_nps_responses_client_id ON public.nps_responses(client_id);
CREATE INDEX idx_nps_responses_token ON public.nps_responses(token);
CREATE INDEX idx_nps_responses_created_at ON public.nps_responses(created_at DESC);
CREATE INDEX idx_nps_responses_empresa ON public.nps_responses(lower(empresa));

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

-- INSERT público (formulário sem login). Aceita anon e authenticated.
CREATE POLICY "Qualquer um envia resposta NPS"
  ON public.nps_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Leitura restrita a usuários autenticados não-viewer.
CREATE POLICY "Usuários internos leem respostas NPS"
  ON public.nps_responses
  FOR SELECT
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Usuários internos atualizam respostas NPS"
  ON public.nps_responses
  FOR UPDATE
  TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins/managers apagam respostas NPS"
  ON public.nps_responses
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- 2. Campos NPS no cliente
ALTER TABLE public.clients
  ADD COLUMN nps_token text UNIQUE,
  ADD COLUMN nps_score integer CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10)),
  ADD COLUMN nps_data timestamp with time zone;

CREATE INDEX idx_clients_nps_token ON public.clients(nps_token);

-- 3. Trigger: ao inserir resposta com token, vincular ao cliente e atualizar nps_score/nps_data
CREATE OR REPLACE FUNCTION public.sync_client_nps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_client uuid;
BEGIN
  -- Se veio com token, tentar achar o cliente pelo token
  IF NEW.client_id IS NULL AND NEW.token IS NOT NULL THEN
    SELECT id INTO matched_client FROM public.clients WHERE nps_token = NEW.token LIMIT 1;
    IF matched_client IS NOT NULL THEN
      NEW.client_id := matched_client;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nps_link_client_before
  BEFORE INSERT ON public.nps_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_nps();

CREATE OR REPLACE FUNCTION public.update_client_nps_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NEW.nps_score IS NOT NULL THEN
    UPDATE public.clients
      SET nps_score = NEW.nps_score,
          nps_data = NEW.created_at
      WHERE id = NEW.client_id
        AND (nps_data IS NULL OR nps_data < NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nps_update_client_after
  AFTER INSERT ON public.nps_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_nps_score();
