-- Etapas de implantação
CREATE TYPE public.implantacao_etapa AS ENUM (
  'novo_cliente',
  'kickoff',
  'configuracao',
  'treinamento',
  'go_live',
  'finalizado'
);

CREATE TABLE public.implantacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  produto TEXT,
  etapa public.implantacao_etapa NOT NULL DEFAULT 'novo_cliente',
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_inicio DATE,
  data_go_live DATE,
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_implantacoes_etapa ON public.implantacoes(etapa);
CREATE INDEX idx_implantacoes_client ON public.implantacoes(client_id);

ALTER TABLE public.implantacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê implantações" ON public.implantacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cria implantações" ON public.implantacoes
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Atualiza implantações" ON public.implantacoes
  FOR UPDATE TO authenticated
  USING (NOT public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Apaga implantações" ON public.implantacoes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_implantacoes_updated
  BEFORE UPDATE ON public.implantacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Templates de mensagens (WhatsApp)
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lê templates" ON public.message_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cria templates" ON public.message_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Atualiza templates" ON public.message_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Apaga templates" ON public.message_templates
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_message_templates_updated
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed dos 4 templates do briefing
INSERT INTO public.message_templates (slug, title, body, variables) VALUES
('boas_vindas', 'Boas-vindas pós-venda',
'Olá {{nome}}! 👋 Sou {{atendente}}, da Nortear. Bem-vindo(a) à família VR/Pontomais! Vou acompanhar sua implantação do início ao fim. Em breve agendamos o kickoff. Qualquer dúvida, é só chamar por aqui.',
ARRAY['nome','atendente']),
('agendamento_kickoff', 'Agendamento de kickoff',
'Oi {{nome}}, tudo bem? Vamos marcar o nosso kickoff de implantação? Tenho disponibilidade {{datas}}. Me confirma o melhor horário pra você. 🚀',
ARRAY['nome','datas']),
('treinamento_marcado', 'Confirmação de treinamento',
'Olá {{nome}}! Seu treinamento está marcado para {{data}} às {{hora}}. Link da reunião: {{link}}. Até lá! 📚',
ARRAY['nome','data','hora','link']),
('go_live', 'Go-live concluído',
'Parabéns {{nome}}! 🎉 Sua implantação foi finalizada com sucesso. A partir de agora, o suporte da Nortear continua à sua disposição. Bom uso!',
ARRAY['nome']);