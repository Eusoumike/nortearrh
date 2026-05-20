import { formatCnpj } from "./formatters";

/**
 * Helpers para exibir clientes nos seletores do sistema.
 *
 * Padrão visual: empresa (razão social) em destaque, contato menor em cinza.
 * No banco a empresa fica em `company` e o contato pode estar em `contact_name`
 * ou no próprio `name` (legado).
 */
export type ClientLike = {
  name?: string | null;
  company?: string | null;
  contact_name?: string | null;
  cnpj?: string | null;
};

/** Remove tudo que não for dígito (para comparar CNPJs com/sem máscara). */
export function normalizeCnpj(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function getClientPrimary(c: ClientLike): string {
  return (c.company || c.name || "—").toString();
}

export function getClientSecondary(c: ClientLike): string {
  const parts: string[] = [];
  if (c.contact_name) parts.push(c.contact_name);
  else if (c.company && c.name) parts.push(c.name);
  if (c.cnpj) parts.push(formatCnpj(c.cnpj));
  return parts.join(" · ");
}

export function getClientLabel(c: ClientLike): string {
  const p = getClientPrimary(c);
  const s = getClientSecondary(c);
  return s ? `${p} — ${s}` : p;
}

/**
 * Filtro + ordenação padrão dos seletores de cliente:
 *   - busca por empresa (prioritária) e contato
 *   - empresas que começam com o termo aparecem primeiro
 */
export function filterAndSortClients<T extends ClientLike>(
  clients: T[],
  searchTerm: string,
): T[] {
  const term = searchTerm.trim().toLowerCase();
  const termDigits = normalizeCnpj(searchTerm);
  // Considera busca por CNPJ quando o usuário digita ao menos 2 dígitos
  // (com ou sem máscara). Aceita também buscas só com letras como nome.
  const isCnpjSearch = termDigits.length >= 2;
  const list = clients.filter((c) => {
    const primary = getClientPrimary(c).toLowerCase();
    const secondary = getClientSecondary(c).toLowerCase();
    if (!term) return true;
    if (primary.includes(term) || secondary.includes(term)) return true;
    if (isCnpjSearch) {
      const cnpjDigits = normalizeCnpj(c.cnpj);
      if (cnpjDigits && cnpjDigits.includes(termDigits)) return true;
    }
    return false;
  });
  list.sort((a, b) => {
    const nameA = getClientPrimary(a).toLowerCase();
    const nameB = getClientPrimary(b).toLowerCase();
    if (term) {
      const aStarts = nameA.startsWith(term);
      const bStarts = nameB.startsWith(term);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
    }
    return nameA.localeCompare(nameB, "pt-BR");
  });
  return list;
}
