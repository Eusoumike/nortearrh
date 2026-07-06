
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS tema text,
  ADD COLUMN IF NOT EXISTS modulo_afetado text,
  ADD COLUMN IF NOT EXISTS origem_problema text,
  ADD COLUMN IF NOT EXISTS solucao_curta text,
  ADD COLUMN IF NOT EXISTS vira_artigo_assist boolean DEFAULT false;

COMMENT ON COLUMN public.tickets.tema IS 'Assunto/tema do chamado com autocomplete dos títulos recorrentes';
COMMENT ON COLUMN public.tickets.modulo_afetado IS 'Módulo afetado: ponto, escalas, feriados, beneficios_vr, faturamento, acessos, relatorios, app_rep, integracao_folha, outros';
COMMENT ON COLUMN public.tickets.origem_problema IS 'Causa raiz: erro_configuracao, duvida_operacional, bug_sistema, permissao_faltando, dado_incorreto, cliente_resolveu_sozinho, outros';
COMMENT ON COLUMN public.tickets.solucao_curta IS 'Resumo em 1 linha do que resolveu (obrigatório ao fechar)';
COMMENT ON COLUMN public.tickets.vira_artigo_assist IS 'Se este chamado deve virar artigo da base de conhecimento';

-- Migração
UPDATE public.tickets SET tema = title WHERE tema IS NULL AND title IS NOT NULL;

UPDATE public.tickets SET modulo_afetado = 'ponto'
WHERE modulo_afetado IS NULL AND (title ILIKE '%ponto%' OR title ILIKE '%fechamento%' OR title ILIKE '%ajuste%' OR title ILIKE '%batida%' OR title ILIKE '%registro%' OR title ILIKE '%processamento%');

UPDATE public.tickets SET modulo_afetado = 'escalas'
WHERE modulo_afetado IS NULL AND (title ILIKE '%escala%' OR title ILIKE '%turno%' OR title ILIKE '%jornada%' OR title ILIKE '%folga%');

UPDATE public.tickets SET modulo_afetado = 'acessos'
WHERE modulo_afetado IS NULL AND (title ILIKE '%acesso%' OR title ILIKE '%login%' OR title ILIKE '%portal%' OR title ILIKE '%bloqueado%');

UPDATE public.tickets SET modulo_afetado = 'beneficios_vr'
WHERE modulo_afetado IS NULL AND (title ILIKE '%cartão vr%' OR title ILIKE '%pedido%vr%' OR title ILIKE '%saldo%' OR title ILIKE '%recolhimento%' OR title ILIKE '%desbloqueio%cartão%');

UPDATE public.tickets SET modulo_afetado = 'faturamento'
WHERE modulo_afetado IS NULL AND (title ILIKE '%boleto%' OR title ILIKE '%cancelamento%' OR title ILIKE '%financeiro%' OR title ILIKE '%nota fiscal%' OR title ILIKE '%comission%');

UPDATE public.tickets SET modulo_afetado = 'app_rep'
WHERE modulo_afetado IS NULL AND (title ILIKE '%relógio%' OR title ILIKE '%coletor%' OR title ILIKE '%aplicativo%' OR title ILIKE '%app %' OR title ILIKE '%rep%');

UPDATE public.tickets SET modulo_afetado = 'integracao_folha'
WHERE modulo_afetado IS NULL AND (title ILIKE '%folha%' OR title ILIKE '%exportação%');

UPDATE public.tickets SET modulo_afetado = 'relatorios'
WHERE modulo_afetado IS NULL AND title ILIKE '%relat%';

UPDATE public.tickets SET modulo_afetado = 'outros' WHERE modulo_afetado IS NULL;

UPDATE public.tickets t
SET solucao_curta = subq.conteudo
FROM (
  SELECT DISTINCT ON (ticket_id) ticket_id, LEFT(content, 200) AS conteudo
  FROM public.ticket_interactions
  WHERE content IS NOT NULL AND LENGTH(content) > 20
  ORDER BY ticket_id, created_at DESC
) subq
WHERE t.id = subq.ticket_id AND t.solucao_curta IS NULL AND t.status = 'resolvido';

UPDATE public.tickets t SET origem_problema = 'erro_configuracao'
WHERE origem_problema IS NULL AND EXISTS (
  SELECT 1 FROM public.ticket_interactions ti WHERE ti.ticket_id = t.id AND (
    ti.content ILIKE '%configuraç%errad%' OR ti.content ILIKE '%turno%errad%' OR ti.content ILIKE '%campo%errad%'
    OR ti.content ILIKE '%estava desmarcado%' OR ti.content ILIKE '%estava ativ%'
    OR ti.content ILIKE '%matricula%errad%' OR ti.content ILIKE '%pis%errad%'
  )
);

UPDATE public.tickets t SET origem_problema = 'duvida_operacional'
WHERE origem_problema IS NULL AND EXISTS (
  SELECT 1 FROM public.ticket_interactions ti WHERE ti.ticket_id = t.id AND (
    ti.content ILIKE '%orient%cliente%' OR ti.content ILIKE '%passo a passo%'
    OR ti.content ILIKE '%ensinado%' OR ti.content ILIKE '%mostr%onde%' OR ti.content ILIKE '%dúvida%san%'
  )
);

UPDATE public.tickets t SET origem_problema = 'permissao_faltando'
WHERE origem_problema IS NULL AND (
  t.title ILIKE '%acesso%' OR t.title ILIKE '%login%' OR t.title ILIKE '%bloqueado%' OR t.title ILIKE '%portal%'
);

UPDATE public.tickets t SET origem_problema = 'outros'
WHERE origem_problema IS NULL AND t.status = 'resolvido';

-- Índices
CREATE INDEX IF NOT EXISTS idx_tickets_tema ON public.tickets(tema);
CREATE INDEX IF NOT EXISTS idx_tickets_modulo_afetado ON public.tickets(modulo_afetado) WHERE modulo_afetado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_origem_problema ON public.tickets(origem_problema) WHERE origem_problema IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_vira_artigo_assist ON public.tickets(vira_artigo_assist) WHERE vira_artigo_assist = true;

-- ticket_temas_frequentes
CREATE TABLE IF NOT EXISTS public.ticket_temas_frequentes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tema text UNIQUE NOT NULL,
  modulo_afetado_sugerido text,
  total_ocorrencias integer DEFAULT 1,
  ultima_ocorrencia timestamptz DEFAULT now(),
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_temas_frequentes TO authenticated;
GRANT ALL ON public.ticket_temas_frequentes TO service_role;

ALTER TABLE public.ticket_temas_frequentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view temas" ON public.ticket_temas_frequentes
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can manage temas" ON public.ticket_temas_frequentes
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.ticket_temas_frequentes (tema, modulo_afetado_sugerido, total_ocorrencias) VALUES
  ('Fechamento de ponto', 'ponto', 10),
  ('Ajuste de ponto', 'ponto', 10),
  ('Acesso ao Super Portal', 'acessos', 8),
  ('Problema de acesso / login', 'acessos', 7),
  ('Banco de horas', 'ponto', 5),
  ('Usuário sem acesso aos recursos no app', 'acessos', 5),
  ('Exportação folha de pagamento', 'integracao_folha', 4),
  ('Escala', 'escalas', 4),
  ('Erro Horas Extras', 'ponto', 4),
  ('Pedidos VR', 'beneficios_vr', 4),
  ('Cartão VR', 'beneficios_vr', 4),
  ('Erro ao registrar ponto', 'app_rep', 4),
  ('Registro de batidas', 'app_rep', 3),
  ('Relógio de Ponto', 'app_rep', 3),
  ('Configuração de turno', 'escalas', 3),
  ('Relatório', 'relatorios', 3),
  ('Feriado', 'feriados', 3),
  ('Abono', 'ponto', 3),
  ('Demissão de colaborador', 'ponto', 3),
  ('Processamento do Ponto', 'ponto', 3),
  ('Calculos de horas', 'ponto', 2),
  ('Coletor REP', 'app_rep', 2),
  ('Base bloqueada', 'acessos', 2)
ON CONFLICT (tema) DO NOTHING;

CREATE OR REPLACE FUNCTION public.atualizar_temas_frequentes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tema IS NOT NULL THEN
    INSERT INTO public.ticket_temas_frequentes (tema, modulo_afetado_sugerido, total_ocorrencias)
    VALUES (NEW.tema, NEW.modulo_afetado, 1)
    ON CONFLICT (tema) DO UPDATE
      SET total_ocorrencias = public.ticket_temas_frequentes.total_ocorrencias + 1,
          ultima_ocorrencia = now(),
          modulo_afetado_sugerido = COALESCE(EXCLUDED.modulo_afetado_sugerido, public.ticket_temas_frequentes.modulo_afetado_sugerido);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_temas ON public.tickets;
CREATE TRIGGER trg_atualizar_temas
  AFTER INSERT OR UPDATE OF tema ON public.tickets
  FOR EACH ROW
  WHEN (NEW.tema IS NOT NULL)
  EXECUTE FUNCTION public.atualizar_temas_frequentes();

-- assist_artigos
CREATE TABLE IF NOT EXISTS public.assist_artigos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  problema_relatado text,
  causa_raiz text,
  passos_solucao text,
  modulo_afetado text,
  tema_relacionado text,
  origem_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  tags text[],
  publicado boolean DEFAULT false,
  visualizacoes integer DEFAULT 0,
  util_positivo integer DEFAULT 0,
  util_negativo integer DEFAULT 0,
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assist_artigos TO authenticated;
GRANT ALL ON public.assist_artigos TO service_role;

ALTER TABLE public.assist_artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view artigos" ON public.assist_artigos
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can manage artigos" ON public.assist_artigos
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_assist_publicado ON public.assist_artigos(publicado) WHERE publicado = true;
CREATE INDEX IF NOT EXISTS idx_assist_modulo ON public.assist_artigos(modulo_afetado);
CREATE INDEX IF NOT EXISTS idx_assist_tags ON public.assist_artigos USING gin(tags);

CREATE TRIGGER update_assist_artigos_updated_at
  BEFORE UPDATE ON public.assist_artigos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_temas_frequentes_updated_at
  BEFORE UPDATE ON public.ticket_temas_frequentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
