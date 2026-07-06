-- ============================================================
-- Fase 3 (item 7) — REMOÇÃO FÍSICA DAS COLUNAS ANTIGAS
-- Rodar APENAS depois de 1-2 semanas em produção com os novos
-- campos (tema, modulo_afetado, origem_problema, solucao_curta,
-- quem_reportou, vira_artigo_assist) e confirmar que nenhuma
-- tela / relatório / integração depende dos campos abaixo.
--
-- Como aplicar (Lovable): copiar este bloco e rodar via
-- supabase--migration com approve.
-- ============================================================

-- 1) Backup dos dados antigos por segurança
CREATE TABLE IF NOT EXISTS public._backup_tickets_campos_antigos AS
SELECT
  id,
  ticket_number,
  impacto,
  resultado_esperado,
  resultado_obtido,
  ja_tentou,
  category,
  acao_tentada,
  created_at
FROM public.tickets
WHERE impacto IS NOT NULL
   OR resultado_esperado IS NOT NULL
   OR resultado_obtido IS NOT NULL
   OR ja_tentou IS NOT NULL
   OR category IS NOT NULL
   OR acao_tentada IS NOT NULL;

-- Restringir acesso ao backup (apenas service_role)
REVOKE ALL ON public._backup_tickets_campos_antigos FROM PUBLIC;
REVOKE ALL ON public._backup_tickets_campos_antigos FROM anon, authenticated;
GRANT ALL ON public._backup_tickets_campos_antigos TO service_role;
ALTER TABLE public._backup_tickets_campos_antigos ENABLE ROW LEVEL SECURITY;

-- 2) Antes do DROP, revisar no código:
--    rg -n "impacto|resultado_esperado|resultado_obtido|ja_tentou|acao_tentada" src
--    rg -n "\"category\"" src   -- ticket_categories continua, coluna category em tickets é o alvo
--
--    Nenhum resultado deve apontar para o formulário/tela em uso.

-- 3) Remover colunas
ALTER TABLE public.tickets
  DROP COLUMN IF EXISTS impacto,
  DROP COLUMN IF EXISTS resultado_esperado,
  DROP COLUMN IF EXISTS resultado_obtido,
  DROP COLUMN IF EXISTS ja_tentou,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS acao_tentada;

-- 4) Após o DROP, regerar os types do Supabase (automático no Lovable).
--    Se algum componente ainda referenciar essas colunas, o build falha
--    e apontará onde ajustar.
