// Opções compartilhadas mantidas após a remoção do módulo CRM legado.

export const STATUS_NORTEAR_OPTIONS: { value: string; label: string; emoji: string; color: string }[] = [
  { value: "ativo_saudavel", label: "Ativo saudável", emoji: "🟢", color: "bg-green-100 text-green-800" },
  { value: "em_risco", label: "Em risco", emoji: "🟡", color: "bg-yellow-100 text-yellow-800" },
  { value: "risco_cancelamento", label: "Risco cancelamento", emoji: "🔴", color: "bg-red-100 text-red-800" },
  { value: "inativo", label: "Inativo", emoji: "⚫", color: "bg-gray-200 text-gray-800" },
  { value: "upsell", label: "Upsell", emoji: "🔵", color: "bg-blue-100 text-blue-800" },
];

export const fmtBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
