/**
 * Utilitários centralizados de SLA, status e prioridade.
 *
 * Este módulo evita duplicação de lógica espalhada em páginas (Tickets,
 * Dashboard, TicketDetail) e componentes (TicketKanban) consolidando:
 *  - Cálculo de estado de SLA (ok / atenção / crítico / estourado).
 *  - Helpers de comparação de deadlines (estourado, ≥80% consumido).
 *  - Helpers de status aberto/fechado.
 *  - Wrappers oficiais para labels e tons (cores) de status e prioridade.
 *
 * Internamente reaproveita:
 *  - `slaStatus()` de `@/lib/formatters`
 *  - `STATUS_LABEL`, `STATUS_TONE`, `PRIORITY_LABEL`, `PRIORITY_TONE` de `@/lib/constants`
 */

import { slaStatus } from "@/lib/formatters";
import {
  STATUS_LABEL,
  STATUS_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/constants";

export type SlaState = "none" | "ok" | "atencao" | "critico" | "estourado";

const CLOSED_STATUSES: ReadonlyArray<string> = ["resolvido", "fechado"];

/** Status considerado "aberto" (não resolvido / não fechado). */
export function isOpenStatus(status: string | null | undefined): boolean {
  return !!status && !CLOSED_STATUSES.includes(status);
}

/** Retorna o label legível do status do ticket. */
export function labelStatus(status: TicketStatus): string {
  return STATUS_LABEL[status] ?? String(status);
}

/** Retorna o tom (token semântico) associado ao status — para badges/cores. */
export function tomStatus(status: TicketStatus) {
  return STATUS_TONE[status];
}

/** Retorna o tom (token semântico) associado à prioridade. */
export function corPrioridade(prioridade: TicketPriority) {
  return PRIORITY_TONE[prioridade];
}

/** Label legível da prioridade. */
export function labelPrioridade(prioridade: TicketPriority): string {
  return PRIORITY_LABEL[prioridade] ?? String(prioridade);
}

/**
 * Calcula o estado de SLA de um ticket a partir do deadline de resolução
 * (ou de um deadline customizado).
 *
 * Retorna sempre um objeto consistente para uso em UI:
 *  - `state`: estado discreto do SLA
 *  - `remaining`: segundos restantes até o deadline (negativo se estourado)
 *  - `percent`: percentual aproximado consumido (0-100), usado em barras
 *  - `label`: descrição legível do estado
 */
export function calcularSLA(
  ticket: { sla_resolution_deadline?: string | null; sla_deadline?: string | null } | null | undefined,
  now: Date = new Date(),
) {
  const deadline = ticket?.sla_resolution_deadline ?? ticket?.sla_deadline ?? null;
  const { state, remaining, percent } = slaStatus(deadline, now);
  return {
    state: state as SlaState,
    remaining,
    percent,
    label: SLA_STATE_LABEL[state as SlaState],
  };
}

const SLA_STATE_LABEL: Record<SlaState, string> = {
  none: "Sem SLA",
  ok: "Dentro do prazo",
  atencao: "Atenção",
  critico: "Crítico",
  estourado: "SLA estourado",
};

/** Verdadeiro se o ticket está aberto e o deadline de resolução já passou. */
export function isSlaOverdue(
  ticket: { status: string; sla_resolution_deadline?: string | null },
  now: number = Date.now(),
): boolean {
  if (!ticket.sla_resolution_deadline) return false;
  if (!isOpenStatus(ticket.status)) return false;
  return new Date(ticket.sla_resolution_deadline).getTime() < now;
}

/**
 * Verdadeiro se o ticket está aberto, ainda não estourou o SLA, mas já
 * consumiu ≥80% do prazo entre criação e deadline (zona de alerta).
 */
export function isSlaApproaching(
  ticket: { status: string; created_at: string; sla_resolution_deadline?: string | null },
  now: number = Date.now(),
  threshold = 0.8,
): boolean {
  if (!isOpenStatus(ticket.status) || !ticket.sla_resolution_deadline) return false;
  const created = new Date(ticket.created_at).getTime();
  const deadline = new Date(ticket.sla_resolution_deadline).getTime();
  const total = deadline - created;
  if (total <= 0) return false;
  if (now >= deadline) return false; // já estourado, não conta como "approaching"
  return (now - created) / total >= threshold;
}

/**
 * Verdadeiro se o ticket está aberto e está em qualquer zona de alerta de SLA:
 * estourado OU ≥80% consumido. Usado em listagens de "alertas SLA ativos".
 */
export function isSlaAlerting(
  ticket: { status: string; created_at: string; sla_resolution_deadline?: string | null },
  now: number = Date.now(),
): boolean {
  return isSlaOverdue(ticket, now) || isSlaApproaching(ticket, now);
}
