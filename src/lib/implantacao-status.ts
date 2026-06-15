// Critério único de saúde da implantação.
// Usado por: KPI/banner do dashboard, filtros do kanban, notificações.

export type ImplantacaoStatus =
  | "concluida"
  | "cancelada"
  | "no_prazo"
  | "em_risco"
  | "atrasado";

export interface ImplantacaoLike {
  etapa?: string | null;
  stage?: string | null;
  data_ultima_transicao?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  data_go_live?: string | null;
}

const FINAL_STAGES = new Set(["finalizado", "go_live"]);
const CANCELED_STAGES = new Set(["cancelado", "cancelada"]);

export function calcDiasNaEtapa(dataReferencia: string | null | undefined): number {
  if (!dataReferencia) return 0;
  const ref = new Date(dataReferencia);
  if (Number.isNaN(ref.getTime())) return 0;
  const ms = Date.now() - ref.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Critério único de status — concluída/cancelada não entram no cálculo.
 * - > 14 dias na etapa → atrasado
 * - > 7 dias na etapa → em_risco
 * - caso contrário → no_prazo
 */
export function calcImplantacaoStatus(
  implantacao: ImplantacaoLike,
  finalStageKey: string = "finalizado",
): ImplantacaoStatus {
  const stage = implantacao.etapa ?? implantacao.stage ?? "";
  if (stage === finalStageKey || FINAL_STAGES.has(stage)) return "concluida";
  if (CANCELED_STAGES.has(stage)) return "cancelada";

  const dias = calcDiasNaEtapa(
    implantacao.data_ultima_transicao ?? implantacao.created_at,
  );
  if (dias > 14) return "atrasado";
  if (dias > 7) return "em_risco";
  return "no_prazo";
}

export function isConcluida(impl: ImplantacaoLike, finalStageKey = "finalizado"): boolean {
  const s = calcImplantacaoStatus(impl, finalStageKey);
  return s === "concluida" || s === "cancelada";
}
