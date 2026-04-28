import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, X } from "lucide-react";
import { NewTicketDialog } from "@/components/NewTicketDialog";
import { TicketKanban } from "@/components/TicketKanban";
import {
  TicketFilters,
  applyTicketFilters,
  loadFilters,
  saveFilters,
  DEFAULT_FILTERS,
  type TicketFiltersState,
} from "@/components/TicketFilters";

export default function Tickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [filters, setFilters] = useState<TicketFiltersState>(() => loadFilters());

  // URL-driven special filters (mantidos): open, sla=overdue|approaching, resolved=7d, client=<nome>
  const openOnly = searchParams.get("open") === "1";
  const slaMode = searchParams.get("sla");
  const resolvedWindow = searchParams.get("resolved");
  const clientUrl = searchParams.get("client");
  const hasSpecialFilter = openOnly || !!slaMode || !!resolvedWindow || !!clientUrl;

  // Persiste filtros sempre que mudarem
  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  // Aplica filtro de cliente via URL ao state (uma vez)
  useEffect(() => {
    if (clientUrl && filters.client !== clientUrl) {
      setFilters((f) => ({ ...f, client: clientUrl }));
    }
    // eslint-disable-next-line
  }, [clientUrl]);

  const clearSpecialFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    next.delete("sla");
    next.delete("resolved");
    next.delete("client");
    setSearchParams(next, { replace: true });
  };

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, client:clients(id, name), assignee:profiles!assigned_to(full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Para o kanban, o filtro de Status não se aplica (cada coluna já é um status).
  const filtered = useMemo(() => {
    let list = applyTicketFilters((tickets as any[]) ?? [], filters, { ignoreStatus: true });
    if (!hasSpecialFilter) return list;
    const now = Date.now();
    const isOpen = (s: string) => !["resolvido", "fechado"].includes(s);
    return list.filter((t: any) => {
      if (openOnly && !isOpen(t.status)) return false;
      if (slaMode === "overdue") {
        if (!t.sla_resolution_deadline || !isOpen(t.status)) return false;
        if (new Date(t.sla_resolution_deadline).getTime() >= now) return false;
      }
      if (slaMode === "approaching") {
        if (!t.sla_resolution_deadline || !isOpen(t.status)) return false;
        const created = new Date(t.created_at).getTime();
        const deadline = new Date(t.sla_resolution_deadline).getTime();
        const total = deadline - created;
        if (total <= 0) return false;
        const ratio = (now - created) / total;
        if (!(ratio >= 0.8 && now < deadline)) return false;
      }
      if (resolvedWindow === "7d") {
        if (!t.resolved_at) return false;
        if (new Date(t.resolved_at).getTime() < now - 7 * 86400000) return false;
      }
      return true;
    });
  }, [tickets, filters, hasSpecialFilter, openOnly, slaMode, resolvedWindow]);

  const specialLabel = openOnly
    ? "Abertos"
    : slaMode === "overdue"
    ? "SLA estourado"
    : slaMode === "approaching"
    ? "Próximos do SLA (≥80%)"
    : resolvedWindow === "7d"
    ? "Resolvidos nos últimos 7 dias"
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 md:p-6">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Tickets</h1>
          <p className="text-xs text-muted-foreground md:text-sm">{filtered.length} ticket{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <Button size="sm" onClick={() => setNewTicketOpen(true)} className="h-9 self-start bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90 sm:self-auto">
          <Plus className="mr-1.5 h-4 w-4" /> Novo chamado
        </Button>
      </div>
      <NewTicketDialog open={newTicketOpen} onOpenChange={setNewTicketOpen} />

      <Card className="shrink-0 p-3">
        <TicketFilters value={filters} onChange={setFilters} resultCount={filtered.length} hideStatus />
        {specialLabel && (
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              Filtro: {specialLabel}
              <button onClick={clearSpecialFilters} className="rounded-full p-0.5 hover:bg-primary/20" aria-label="Remover filtro">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </Card>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <TicketKanban tickets={filtered as any} />
        )}
      </div>
    </div>
  );
}
