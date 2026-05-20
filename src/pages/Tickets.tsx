import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, X } from "lucide-react";
import { STATUS_LABEL, STATUS_FLOW, PRIORITY_LABEL, type TicketStatus, type TicketPriority } from "@/lib/constants";
import { isOpenStatus, isSlaOverdue, isSlaApproaching } from "@/lib/sla";
import { TicketKanban } from "@/components/TicketKanban";

export default function Tickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [priorityFilter, setPriorityFilter] = useState<string>(searchParams.get("priority") ?? "all");

  // URL-driven special filters: open (não resolvidos), sla=overdue|approaching, resolved=7d, client=<nome>
  const openOnly = searchParams.get("open") === "1";
  const slaMode = searchParams.get("sla"); // "overdue" | "approaching"
  const resolvedWindow = searchParams.get("resolved"); // "7d"
  const clientFilter = searchParams.get("client"); // nome (client_name/organization)

  const hasSpecialFilter = openOnly || !!slaMode || !!resolvedWindow || !!clientFilter;

  // Sincroniza select com URL quando muda externamente
  useEffect(() => {
    const s = searchParams.get("status") ?? "all";
    const p = searchParams.get("priority") ?? "all";
    setStatusFilter(s);
    setPriorityFilter(p);
  }, [searchParams]);

  const updateStatus = (v: string) => {
    setStatusFilter(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("status");
    else next.set("status", v);
    setSearchParams(next, { replace: true });
  };

  const updatePriority = (v: string) => {
    setPriorityFilter(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("priority");
    else next.set("priority", v);
    setSearchParams(next, { replace: true });
  };

  const clearSpecialFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    next.delete("sla");
    next.delete("resolved");
    next.delete("client");
    setSearchParams(next, { replace: true });
  };

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("id, title, status, priority, channel, client_name, opened_at, created_at, first_response_at, assigned_to, sla_deadline, ticket_number, category, client_id, client:clients!fk_tickets_client(id, name), assignee:profiles!assigned_to(full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") query = query.eq("status", statusFilter as TicketStatus);
      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as TicketPriority);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const list = tickets ?? [];
    if (!hasSpecialFilter) return list;
    const now = Date.now();
    const clientNeedle = clientFilter?.trim().toLowerCase() ?? "";
    return list.filter((t: any) => {
      if (openOnly && !isOpenStatus(t.status)) return false;
      if (slaMode === "overdue" && !isSlaOverdue(t, now)) return false;
      if (slaMode === "approaching" && !isSlaApproaching(t, now)) return false;
      if (resolvedWindow === "7d") {
        if (!t.resolved_at) return false;
        if (new Date(t.resolved_at).getTime() < now - 7 * 86400000) return false;
      }
      if (clientNeedle) {
        const name = (t.client_name ?? t.organization ?? t.client?.name ?? "").toLowerCase();
        if (name !== clientNeedle) return false;
      }
      return true;
    });
  }, [tickets, hasSpecialFilter, openOnly, slaMode, resolvedWindow, clientFilter]);

  const specialLabel = openOnly
    ? "Abertos"
    : slaMode === "overdue"
    ? "SLA estourado"
    : slaMode === "approaching"
    ? "Próximos do SLA (≥80%)"
    : resolvedWindow === "7d"
    ? "Resolvidos nos últimos 7 dias"
    : clientFilter
    ? `Cliente: ${clientFilter}`
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 md:p-6">
      {/* Header com filtros à direita */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Tickets</h1>
          <p className="text-xs text-muted-foreground md:text-sm">{filtered.length} ticket{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={updateStatus}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_FLOW.map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={updatePriority}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {specialLabel && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            Filtro: {specialLabel}
            <button onClick={clearSpecialFilters} className="rounded-full p-0.5 hover:bg-primary/20" aria-label="Remover filtro">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Kanban (preenche restante) */}
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
