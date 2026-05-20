import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Filter, X, Eye, EyeOff, Plus } from "lucide-react";
import { STATUS_LABEL, STATUS_FLOW, PRIORITY_LABEL, type TicketStatus, type TicketPriority } from "@/lib/constants";
import { isOpenStatus, isSlaOverdue, isSlaApproaching } from "@/lib/sla";
import { TicketKanban } from "@/components/TicketKanban";
import { cn } from "@/lib/utils";


const SHOW_RESOLVED_KEY = "nortear_show_resolved_tickets";

export default function Tickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [priorityFilter, setPriorityFilter] = useState<string>(searchParams.get("priority") ?? "all");
  const [showResolved, setShowResolved] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SHOW_RESOLVED_KEY) === "1";
  });

  // URL-driven special filters: open (não resolvidos), sla=overdue|approaching, resolved=7d, client=<nome>
  const openOnly = searchParams.get("open") === "1";
  const slaMode = searchParams.get("sla"); // "overdue" | "approaching"
  const resolvedWindow = searchParams.get("resolved"); // "7d"
  const clientFilter = searchParams.get("client"); // nome (client_name/organization)

  const hasSpecialFilter = openOnly || !!slaMode || !!resolvedWindow || !!clientFilter;
  // Se o filtro especial "resolved=7d" estiver ativo ou o usuário filtrou status=resolvido, força mostrar resolvidos
  const includeResolved = showResolved || statusFilter === "resolvido" || resolvedWindow === "7d";

  const toggleShowResolved = () => {
    const next = !showResolved;
    setShowResolved(next);
    try {
      window.localStorage.setItem(SHOW_RESOLVED_KEY, next ? "1" : "0");
    } catch {}
  };

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
    queryKey: ["tickets", statusFilter, priorityFilter, includeResolved],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("id, title, status, priority, channel, client_name, opened_at, created_at, first_response_at, assigned_to, sla_deadline, ticket_number, category, client_id, client:clients!fk_tickets_client(id, name), assignee:profiles!assigned_to(full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") query = query.eq("status", statusFilter as TicketStatus);
      else if (!includeResolved) query = query.not("status", "in", "(resolvido,fechado)");
      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as TicketPriority);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Contagem de chamados resolvidos hoje (para o badge do botão)
  const { data: resolvedTodayCount = 0 } = useQuery({
    queryKey: ["tickets", "resolved-today-count"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["resolvido", "fechado"])
        .gte("resolved_at", start.toISOString());
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
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

  const navigate = useNavigate();
  const activeCount = (tickets ?? []).filter((t: any) => isOpenStatus(t.status)).length;
  const STATUS_CHIPS: { key: string; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "novo", label: "Novo" },
    { key: "em_atendimento", label: "Em atendimento" },
    { key: "aguardando_cliente", label: "Aguardando" },
    { key: "suporte_vera_n1", label: "Suporte N1" },
    { key: "abertura_chamado_n2", label: "N2" },
    { key: "resolvido", label: "Resolvido" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Central de Chamados"
        subtitle={`${activeCount} chamado${activeCount === 1 ? "" : "s"} ativo${activeCount === 1 ? "" : "s"} · ${filtered.length} exibido${filtered.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Select value={priorityFilter} onValueChange={updatePriority}>
              <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas prioridades</SelectItem>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant={showResolved ? "default" : "outline"}
              onClick={toggleShowResolved}
              className="h-9 gap-1.5"
              aria-pressed={showResolved}
            >
              {showResolved ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Resolvidos</span>
              {resolvedTodayCount > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[10px] font-semibold",
                  showResolved ? "bg-primary-foreground/20 text-primary-foreground" : "bg-success/15 text-success",
                )}>
                  {resolvedTodayCount}
                </span>
              )}
            </Button>
            <Button size="sm" className="h-9 gap-1.5" onClick={() => navigate("/tickets/novo")}>
              <Plus className="h-3.5 w-3.5" /> Novo Chamado
            </Button>
          </>
        }
      />

      {/* Filtros chips sempre visíveis */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {STATUS_CHIPS.map((c) => {
          const active = statusFilter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => updateStatus(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80",
              )}
            >
              {c.label}
            </button>
          );
        })}
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
          <TicketKanbanWithAssist tickets={filtered as any} showResolved={includeResolved} />
        )}
      </div>
    </div>
  );
}

function TicketKanbanWithAssist({ tickets, showResolved }: { tickets: any[]; showResolved: boolean }) {
  const { data: assistedIds } = useQuery({
    queryKey: ["assist-conversation-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assist_conversations" as any)
        .select("ticket_id");
      if (error) return new Set<string>();
      return new Set<string>(((data as any[]) ?? []).map((r: any) => r.ticket_id).filter(Boolean));
    },
    staleTime: 60_000,
  });
  return <TicketKanban tickets={tickets} showResolved={showResolved} assistedIds={assistedIds ?? new Set()} />;
}
