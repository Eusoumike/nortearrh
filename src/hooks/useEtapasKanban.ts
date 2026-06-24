import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_FLOW, STATUS_LABEL, type TicketStatus } from "@/lib/constants";

export interface EtapaKanban {
  /** Identificador único — para etapas base é o próprio status enum; para customizadas é o stage_key */
  slug: string;
  /** Nome exibido na UI */
  name: string;
  /** Cor (hex ou nome de classe) da barrinha/badge */
  color: string;
  /** Ordem geral no kanban */
  order_index: number;
  /** Status base do enum ao qual essa etapa pertence (define SLA/relatórios) */
  status_base: TicketStatus;
  /** true para etapas do enum, false para sub-etapas customizadas */
  is_system: boolean;
  is_resolved?: boolean;
  /** Para etapas customizadas, id da row em custom_ticket_stages */
  id?: string;
}

// Cores padrão das etapas base (consistente com STATUS_TONE)
const BASE_COLORS: Record<TicketStatus, string> = {
  novo: "#3B82F6",
  em_atendimento: "#F59E0B",
  aguardando_cliente: "#C4622D",
  suporte_vera_n1: "#8B5CF6",
  abertura_chamado_n2: "#D64545",
  resolvido: "#1D9E75",
  fechado: "#1D9E75",
};

// Ordens das etapas base (espaços de 100 para encaixar customizadas após cada uma)
const BASE_ORDER: Record<TicketStatus, number> = {
  novo: 0,
  em_atendimento: 100,
  aguardando_cliente: 200,
  suporte_vera_n1: 300,
  abertura_chamado_n2: 400,
  resolvido: 999,
  fechado: 999,
};

const ETAPAS_BASE: EtapaKanban[] = STATUS_FLOW.map((s) => ({
  slug: s,
  name: STATUS_LABEL[s],
  color: BASE_COLORS[s],
  order_index: BASE_ORDER[s],
  status_base: s,
  is_system: true,
  is_resolved: s === "resolvido",
}));

export function useEtapasKanban() {
  return useQuery({
    queryKey: ["custom-ticket-stages"],
    queryFn: async (): Promise<EtapaKanban[]> => {
      const { data, error } = await supabase
        .from("custom_ticket_stages" as any)
        .select("id, stage_key, label, color, base_status, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) return ETAPAS_BASE;
      const customizadas: EtapaKanban[] = ((data as any[]) ?? []).map((c, idx) => ({
        id: c.id,
        slug: c.stage_key,
        name: c.label,
        color: c.color,
        // Ordena imediatamente após a etapa base correspondente
        order_index: (BASE_ORDER[c.base_status as TicketStatus] ?? 100) + 1 + idx,
        status_base: c.base_status as TicketStatus,
        is_system: false,
      }));
      return [...ETAPAS_BASE, ...customizadas].sort((a, b) => a.order_index - b.order_index);
    },
    staleTime: 60_000,
  });
}

/** Resolve a etapa atual de um ticket (sub-etapa customizada > status base) */
export function getEtapaAtual(
  ticket: { status?: TicketStatus | string | null; active_custom_stage_key?: string | null },
  etapas: EtapaKanban[],
): EtapaKanban | null {
  if (ticket.active_custom_stage_key) {
    const cs = etapas.find((e) => !e.is_system && e.slug === ticket.active_custom_stage_key);
    if (cs) return cs;
  }
  const base = ticket.status === "fechado" ? "resolvido" : ticket.status;
  return etapas.find((e) => e.is_system && e.slug === base) ?? null;
}
