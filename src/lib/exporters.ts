import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { STATUS_LABEL, PRIORITY_LABEL, TICKET_TYPE_LABEL, CHANNEL_LABEL, type TicketType } from "@/lib/constants";

export interface ExportTicket {
  ticket_number: number;
  title: string;
  ticket_type: TicketType | null;
  status: keyof typeof STATUS_LABEL;
  priority: keyof typeof PRIORITY_LABEL;
  channel: keyof typeof CHANNEL_LABEL;
  client_name: string | null;
  created_at: string;
  resolved_at: string | null;
  sla_resolution_deadline: string | null;
}

function durationHours(from: string, to: string | null) {
  if (!to) return null;
  return ((new Date(to).getTime() - new Date(from).getTime()) / 3600_000).toFixed(1);
}

function slaCumprido(t: ExportTicket): string {
  if (!t.resolved_at || !t.sla_resolution_deadline) return "—";
  return new Date(t.resolved_at) <= new Date(t.sla_resolution_deadline) ? "Sim" : "Não";
}

function rows(tickets: ExportTicket[]) {
  return tickets.map((t) => ({
    "Número": `#${t.ticket_number}`,
    "Título": t.title,
    "Tipo": t.ticket_type ? TICKET_TYPE_LABEL[t.ticket_type] : "—",
    "Cliente": t.client_name ?? "—",
    "Status": STATUS_LABEL[t.status],
    "Prioridade": PRIORITY_LABEL[t.priority],
    "Canal": CHANNEL_LABEL[t.channel] ?? t.channel,
    "Aberto em": new Date(t.created_at).toLocaleString("pt-BR"),
    "Resolvido em": t.resolved_at ? new Date(t.resolved_at).toLocaleString("pt-BR") : "—",
    "Tempo (h)": durationHours(t.created_at, t.resolved_at) ?? "—",
    "SLA cumprido": slaCumprido(t),
  }));
}

export function exportTicketsCsv(tickets: ExportTicket[], filename = "relatorio-suporte.csv") {
  const csv = Papa.unparse(rows(tickets));
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTicketsPdf(tickets: ExportTicket[], summary: { open: number; overdue: number; resolved: number; avgRespHrs: string }) {
  const doc = new jsPDF({ orientation: "landscape" });
  const today = new Date().toLocaleDateString("pt-BR");

  doc.setFontSize(16);
  doc.text("Relatório de Suporte — Nortear", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Gerado em ${today} · ${tickets.length} chamados`, 14, 22);

  // KPIs
  doc.setTextColor(40);
  doc.setFontSize(11);
  const kpis = [
    `Abertos: ${summary.open}`,
    `SLA estourado: ${summary.overdue}`,
    `Resolvidos (7d): ${summary.resolved}`,
    `Resposta média: ${summary.avgRespHrs}`,
  ];
  doc.text(kpis.join("    ·    "), 14, 30);

  // By type breakdown
  const byType: Record<string, number> = {};
  tickets.forEach((t) => {
    const k = t.ticket_type ? TICKET_TYPE_LABEL[t.ticket_type] : "Sem tipo";
    byType[k] = (byType[k] || 0) + 1;
  });

  autoTable(doc, {
    startY: 36,
    head: [["Tipo de chamado", "Total"]],
    body: Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]),
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    tableWidth: 80,
  });

  const r = rows(tickets);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [Object.keys(r[0] ?? { "Sem dados": "" })],
    body: r.map((row) => Object.values(row).map((v) => String(v))),
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 7, cellPadding: 1.5 },
    margin: { left: 14, right: 14 },
  });

  doc.save("relatorio-suporte.pdf");
}
