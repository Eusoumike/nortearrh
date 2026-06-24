import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_FLOW, STATUS_LABEL, STATUS_TONE, type TicketStatus } from "@/lib/constants";

/**
 * Sub-etapa customizada criada via "+ Nova etapa" no kanban.
 * Convive com as 6 etapas-base do enum `ticket_status` (STATUS_FLOW).
 */
export interface CustomStage {
  id: string;
  stage_key: string;
  label: string;
  color: string;
  base_status: TicketStatus;
  ordem: number;
}

/**
 * Item unificado consumido pelo kanban, popup "Escalar / Mudar Status",
 * filtros e qualquer dropdown que precise listar etapas.
 */
export interface EtapaItem {
  kind: "base" | "custom";
  /** Chave estável para identificar a etapa em selects (`status` ou `custom:<stage_key>`). */
  key: string;
  label: string;
  /** Status enum subjacente (para gravar em tickets.status). */
  base: TicketStatus;
  /** Para etapas customizadas, o stage_key (a gravar em active_custom_stage_key). */
  customKey: string | null;
  /** Cor para badge/stripe (etapas-base não têm cor explícita). */
  color?: string;
  tone?: string;
}

/**
 * Hook ÚNICO — fonte de verdade para sub-etapas customizadas.
 * Lê `custom_ticket_stages` (apenas ativas) ordenadas por `ordem`.
 */
export function useCustomStages() {
  return useQuery({
    queryKey: ["custom-ticket-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_ticket_stages" as any)
        .select("id, stage_key, label, color, base_status, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) {
        console.error("Erro ao buscar etapas customizadas:", error);
        return [] as CustomStage[];
      }
      return (data as any[]) as CustomStage[];
    },
    staleTime: 60_000,
  });
}

/**
 * Lista combinada (etapas-base + sub-etapas customizadas) na ordem do kanban:
 * para cada status-base do STATUS_FLOW, intercala suas sub-etapas customizadas.
 */
export function useEtapasKanban() {
  const customQ = useCustomStages();
  const customStages = customQ.data ?? [];

  const items: EtapaItem[] = [];
  for (const base of STATUS_FLOW) {
    items.push({
      kind: "base",
      key: base,
      label: STATUS_LABEL[base],
      base,
      customKey: null,
      tone: STATUS_TONE[base],
    });
    customStages
      .filter((c) => c.base_status === base)
      .sort((a, b) => a.ordem - b.ordem)
      .forEach((c) =>
        items.push({
          kind: "custom",
          key: `custom:${c.stage_key}`,
          label: c.label,
          base: c.base_status,
          customKey: c.stage_key,
          color: c.color,
        }),
      );
  }

  return { ...customQ, items, customStages };
}
