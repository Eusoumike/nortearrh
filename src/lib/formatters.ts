import { formatDistanceToNow, format, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ============================================================
 * Fuso horário — REGRA ABSOLUTA
 * Tudo que é gravado no banco vai em UTC. A conversão para
 * Brasília (America/Sao_Paulo, GMT-3) acontece APENAS na exibição.
 * ============================================================ */

/** Retorna horário atual de Brasília no formato `YYYY-MM-DDTHH:mm`
 *  pronto pra usar como valor inicial de `<input type="datetime-local">`. */
export function nowBrasilia(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Converte o valor de um `<input type="datetime-local">` (interpretado
 *  como horário de Brasília) para ISO UTC antes de salvar no banco. */
export function brazilInputToISO(localValue: string): string | null {
  if (!localValue) return null;
  return new Date(localValue + ":00-03:00").toISOString();
}

/** Formata uma data ISO (UTC) para exibição completa em Brasília:
 *  `dd/mm/aaaa hh:mm`. */
export function formatBrazilDateTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(date)).replace(",", "");
}

/** Formato curto pra timeline: `dd/mm hh:mm`. */
export function formatBrazilTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(date));
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

export function formatDate(date: string | Date, pattern = "dd MMM yyyy, HH:mm"): string {
  return format(new Date(date), pattern, { locale: ptBR });
}

export function formatShortDate(date: string | Date): string {
  return format(new Date(date), "dd MMM", { locale: ptBR });
}

/** SLA: returns { remaining_seconds, percent_consumed, state } */
export function slaStatus(deadline: string | null | undefined, now = new Date()) {
  if (!deadline) return { state: "none" as const, remaining: 0, percent: 0 };
  const deadlineDate = new Date(deadline);
  const remaining = differenceInSeconds(deadlineDate, now);

  if (remaining < 0) return { state: "estourado" as const, remaining, percent: 100 };
  if (remaining < 3600) return { state: "critico" as const, remaining, percent: 90 };
  if (remaining < 14400) return { state: "atencao" as const, remaining, percent: 70 };
  return { state: "ok" as const, remaining, percent: 30 };
}

export function formatDuration(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const sign = totalSeconds < 0 ? "-" : "";

  if (days > 0) return `${sign}${days}d ${hours}h`;
  if (hours > 0) return `${sign}${hours}h ${mins}m`;
  return `${sign}${mins}m`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}
