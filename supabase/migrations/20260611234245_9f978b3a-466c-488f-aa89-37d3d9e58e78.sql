-- 1) Novos campos
ALTER TABLE public.implantacoes
  ADD COLUMN IF NOT EXISTS data_ultima_transicao timestamptz,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'no_prazo',
  ADD COLUMN IF NOT EXISTS observacoes_conta text,
  ADD COLUMN IF NOT EXISTS arquivos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Carga inicial: usa updated_at como melhor aproximação da última transição
UPDATE public.implantacoes
SET data_ultima_transicao = COALESCE(data_ultima_transicao, updated_at, created_at)
WHERE data_ultima_transicao IS NULL;

-- 3) Trigger: sempre que etapa muda, atualiza data_ultima_transicao
CREATE OR REPLACE FUNCTION public.set_data_ultima_transicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.data_ultima_transicao := COALESCE(NEW.data_ultima_transicao, now());
  ELSIF TG_OP = 'UPDATE' AND NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    NEW.data_ultima_transicao := now();
    NEW.health_status := 'no_prazo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_implantacoes_data_ultima_transicao ON public.implantacoes;
CREATE TRIGGER trg_implantacoes_data_ultima_transicao
BEFORE INSERT OR UPDATE ON public.implantacoes
FOR EACH ROW EXECUTE FUNCTION public.set_data_ultima_transicao();

-- 4) Função para recalcular health de todos os clientes ativos
CREATE OR REPLACE FUNCTION public.atualizar_health_implantacoes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.implantacoes
  SET health_status = CASE
    WHEN EXTRACT(EPOCH FROM (now() - COALESCE(data_ultima_transicao, updated_at, created_at))) / 86400 > 14 THEN 'atrasado'
    WHEN EXTRACT(EPOCH FROM (now() - COALESCE(data_ultima_transicao, updated_at, created_at))) / 86400 > 7  THEN 'em_risco'
    ELSE 'no_prazo'
  END
  WHERE etapa NOT IN ('finalizado');
END;
$$;

-- 5) Recalcular agora
SELECT public.atualizar_health_implantacoes();