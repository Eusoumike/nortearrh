import { addMonths, differenceInCalendarDays, format, startOfMonth } from "date-fns";

export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export const ymdFirst = (d: Date) => format(startOfMonth(d), "yyyy-MM-dd");

export function vencimentoTone(venc: string | null) {
  if (!venc) return "muted" as const;
  const d = new Date(venc + "T00:00:00");
  const days = differenceInCalendarDays(d, new Date());
  if (days < 0) return "danger" as const;
  if (days <= 30) return "warning" as const;
  return "ok" as const;
}

export function calcVencimento(start: string | null, meses: number | null) {
  if (!start || !meses) return null;
  const d = new Date(start + "T00:00:00");
  return format(addMonths(d, meses), "yyyy-MM-dd");
}

export function formatBRDate(date: string | null) {
  if (!date) return "—";
  return format(new Date(date + "T00:00:00"), "dd/MM/yyyy");
}
