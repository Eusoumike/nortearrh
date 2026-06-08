// Cálculo da completude do cadastro do cliente.
// Único ponto de verdade para badges e tooltips.

export const COMPLETENESS_FIELDS: { key: string; label: string }[] = [
  { key: "razao_social", label: "Razão social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "contact_name", label: "Nome do contato" },
  { key: "contact_email", label: "E-mail do contato" },
  { key: "contact_phone", label: "Telefone do contato" },
  { key: "municipio", label: "Município" },
  { key: "estado", label: "Estado" },
  { key: "products", label: "Produtos contratados" },
  { key: "status_nortear", label: "Status Nortear" },
];

export type ClientCompleteness = {
  score: number; // 0-100
  level: "complete" | "partial" | "incomplete";
  missing: string[]; // labels dos campos faltantes
};

function hasValue(v: any) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

export function computeCompleteness(client: any): ClientCompleteness {
  if (!client) return { score: 0, level: "incomplete", missing: [] };
  const missing: string[] = [];
  let filled = 0;
  for (const f of COMPLETENESS_FIELDS) {
    if (hasValue(client[f.key])) filled++;
    else missing.push(f.label);
  }
  const score = Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
  const level: ClientCompleteness["level"] =
    score >= 90 ? "complete" : score >= 60 ? "partial" : "incomplete";
  return { score, level, missing };
}
