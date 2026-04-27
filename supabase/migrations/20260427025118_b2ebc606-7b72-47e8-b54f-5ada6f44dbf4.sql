-- Tabela de títulos pré-cadastrados de chamado
CREATE TABLE public.ticket_titles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê títulos de chamado"
ON public.ticket_titles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Cria títulos de chamado"
ON public.ticket_titles FOR INSERT
TO authenticated
WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Atualiza títulos de chamado"
ON public.ticket_titles FOR UPDATE
TO authenticated
USING (NOT has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Apaga títulos de chamado"
ON public.ticket_titles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_ticket_titles_updated_at
BEFORE UPDATE ON public.ticket_titles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed das opções padrão
INSERT INTO public.ticket_titles (name) VALUES
  ('Dúvida sobre o sistema'),
  ('Erro ao registrar ponto'),
  ('Problema de acesso / login'),
  ('Ajuste de ponto'),
  ('Configuração de turno'),
  ('Cadastro de colaborador'),
  ('Importação de planilha'),
  ('Fechamento de ponto'),
  ('Relatório'),
  ('Banco de horas'),
  ('Solicitação de suporte'),
  ('Outros')
ON CONFLICT (name) DO NOTHING;