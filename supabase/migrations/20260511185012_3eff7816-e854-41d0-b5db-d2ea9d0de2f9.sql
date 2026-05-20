
-- 1) Mesclar duplicidade Botolifting
UPDATE lancamentos_vr SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE tickets SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE implantacoes SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE contratos_rh_digital SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE parcelas_rh_digital SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE lancamentos_ponto SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE tasks SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE configuracoes_parceiro SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE repasses_parceiro SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE documentos_financeiros SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE deals SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
UPDATE nps_responses SET client_id='5c5cfcc5-ac67-451e-a66b-133ad0f7c3e8' WHERE client_id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';
DELETE FROM clients WHERE id='a8f50ff3-d7fe-4ad9-a34e-b1d80ef74e4d';

-- 2) Anexar triggers de geração de repasses
DROP TRIGGER IF EXISTS trg_gerar_repasses_rh_on_pagamento ON public.parcelas_rh_digital;
CREATE TRIGGER trg_gerar_repasses_rh_on_pagamento
AFTER UPDATE ON public.parcelas_rh_digital
FOR EACH ROW EXECUTE FUNCTION public.gerar_repasses_rh_on_pagamento();

DROP TRIGGER IF EXISTS trg_gerar_repasses_vr_primeira_carga ON public.lancamentos_vr;
CREATE TRIGGER trg_gerar_repasses_vr_primeira_carga
AFTER INSERT ON public.lancamentos_vr
FOR EACH ROW EXECUTE FUNCTION public.gerar_repasses_vr_primeira_carga();

-- 3) Backfill VR primeira_carga
INSERT INTO public.repasses_parceiro (
  parceiro_id, parceiro_nome, client_id, cliente_nome,
  produto, tipo_repasse, percentual, valor_base, valor_repasse,
  competencia, origem_id
)
SELECT cp.parceiro_id, p.nome, lv.client_id, lv.cliente_nome,
  'vr_beneficios'::produto_parceiro, 'primeira_carga_vr'::tipo_repasse_parceiro,
  cp.percentual, lv.valor_comissao,
  ROUND(COALESCE(lv.valor_comissao,0) * cp.percentual / 100.0, 2),
  lv.competencia, lv.id
FROM public.lancamentos_vr lv
JOIN public.configuracoes_parceiro cp
  ON cp.client_id = lv.client_id
 AND cp.produto = 'vr_beneficios'
 AND cp.tipo_repasse = 'primeira_carga_vr'
 AND cp.ativo = true
 AND cp.percentual > 0
JOIN public.parceiros p ON p.id = cp.parceiro_id AND p.ativo = true
WHERE lv.tipo = 'primeira_carga'
  AND NOT EXISTS (
    SELECT 1 FROM public.repasses_parceiro rp
    WHERE rp.parceiro_id = cp.parceiro_id
      AND rp.client_id = lv.client_id
      AND rp.produto = 'vr_beneficios'
      AND rp.tipo_repasse = 'primeira_carga_vr'
  );

-- 4) Backfill RH para parcelas já pagas
INSERT INTO public.repasses_parceiro (
  parceiro_id, parceiro_nome, client_id, cliente_nome,
  produto, tipo_repasse, percentual, valor_base, valor_repasse,
  competencia, origem_id
)
SELECT cp.parceiro_id, p.nome, par.client_id, par.cliente_nome,
  'rh_digital'::produto_parceiro, cp.tipo_repasse,
  cp.percentual, par.valor_nortear,
  ROUND(par.valor_nortear * cp.percentual / 100.0, 2),
  par.competencia, par.id
FROM public.parcelas_rh_digital par
JOIN public.configuracoes_parceiro cp
  ON cp.client_id = par.client_id
 AND cp.produto = 'rh_digital'
 AND cp.ativo = true
JOIN public.parceiros p ON p.id = cp.parceiro_id AND p.ativo = true
WHERE par.status = 'pago'
  AND NOT EXISTS (
    SELECT 1 FROM public.repasses_parceiro rp2
    WHERE rp2.parceiro_id = cp.parceiro_id
      AND rp2.client_id = par.client_id
      AND rp2.produto = 'rh_digital'
      AND rp2.tipo_repasse = cp.tipo_repasse
      AND (cp.tipo_repasse = 'primeira_mensalidade' OR rp2.competencia = par.competencia)
  );
