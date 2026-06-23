import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Eye, EyeOff, Plus, LayoutGrid, List, Filter } from "lucide-react";
import { STATUS_LABEL, STATUS_FLOW, PRIORITY_LABEL, type TicketStatus, type TicketPriority } from "@/lib/constants";
import { isOpenStatus, isSlaOverdue, isSlaApproaching } from "@/lib/sla";
import { TicketKanban, type CustomStage } from "@/components/TicketKanban";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { NewTicketDialog } from "@/components/NewTicketDialog";
import { NovaEtapaDialog } from "@/components/tickets/NovaEtapaDialog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const SHOW_RESOLVED_KEY = "nortear_show_resolved_tickets";
const VIEW_MODE_KEY = "nortear_tickets_view_mode";

type ViewMode = "kanban" | "list";

export default function Tickets() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [priorityFilter, setPriorityFilter] = useState<string>(searchParams.get("priority") ?? "all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [novaEtapaOpen, setNovaEtapaOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "kanban";
    return (window.localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "kanban";
  });
  const [showResolved, setShowResolved] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SHOW_RESOLVED_KEY) === "1";
  });

  const openOnly = searchParams.get("open") === "1";
  const slaMode = searchParams.get("sla");
  const resolvedWindow = searchParams.get("resolved");
  const clientFilter = searchParams.get("client");

  const hasSpecialFilter = openOnly || !!slaMode || !!resolvedWindow || !!clientFilter;
  const includeResolved = showResolved || statusFilter === "resolvido" || resolvedWindow === "7d";

  const toggleShowResolved = () => {
    const next = !showResolved;
    setShowResolved(next);
    try { window.localStorage.setItem(SHOW_RESOLVED_KEY, next ? "1" : "0"); } catch {}
  };

  const setView = (m: ViewMode) => {
    setViewMode(m);
    try { window.localStorage.setItem(VIEW_MODE_KEY, m); } catch {}
  };

  useEffect(() => {
    setStatusFilter(searchParams.get("status") ?? "all");
    setPriorityFilter(searchParams.get("priority") ?? "all");
  }, [searchParams]);

  const updateStatus = (v: string) => {
    setStatusFilter(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("status"); else next.set("status", v);
    setSearchParams(next, { replace: true });
  };

  const updatePriority = (v: string) => {
    setPriorityFilter(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("priority"); else next.set("priority", v);
    setSearchParams(next, { replace: true });
  };

  const clearSpecialFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("open"); next.delete("sla"); next.delete("resolved"); next.delete("client");
    setSearchParams(next, { replace: true });
  };

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter, includeResolved],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("id, title, status, priority, channel, client_name, opened_at, created_at, first_response_at, assigned_to, sla_deadline, ticket_number, category, client_id, active_custom_stage_key, client:clients!fk_tickets_client(id, name), assignee:profiles!assigned_to(full_name, avatar_url)")
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

  const { data: resolvedTodayCount = 0 } = useQuery({
    queryKey: ["tickets", "resolved-today-count"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("tickets").select("id", { count: "exact", head: true })
        .in("status", ["resolvido", "fechado"])
        .gte("resolved_at", start.toISOString());
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    let list = tickets ?? [];
    if (hasSpecialFilter) {
      const now = Date.now();
      const clientNeedle = clientFilter?.trim().toLowerCase() ?? "";
      list = list.filter((t: any) => {
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
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t: any) =>
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.ticket_number ?? "").toLowerCase().includes(q) ||
        (t.client_name ?? t.client?.name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, hasSpecialFilter, openOnly, slaMode, resolvedWindow, clientFilter, search]);

  const specialLabel = openOnly ? "Abertos"
    : slaMode === "overdue" ? "SLA estourado"
    : slaMode === "approaching" ? "Próximos do SLA"
    : resolvedWindow === "7d" ? "Resolvidos nos últimos 7 dias"
    : clientFilter ? `Cliente: ${clientFilter}` : null;

  const activeCount = (tickets ?? []).filter((t: any) => isOpenStatus(t.status)).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      {/* HEADER */}
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <nav className="mb-1 text-[11px] text-muted-foreground" aria-label="Breadcrumb">
            <span className="font-medium text-foreground/80">Central de Chamados</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">Central de Chamados</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeCount} chamado{activeCount === 1 ? "" : "s"} ativo{activeCount === 1 ? "" : "s"} · {resolvedTodayCount} resolvido{resolvedTodayCount === 1 ? "" : "s"} hoje
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Lista/Kanban */}
          <div className="inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                viewMode === "list" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                viewMode === "kanban" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
          </div>
          <Button
            type="button" size="sm" variant={showResolved ? "default" : "outline"}
            onClick={toggleShowResolved}
            className={cn("h-9 gap-1.5 rounded-xl text-xs", showResolved && "shadow-sm")}
            aria-pressed={showResolved}
          >
            {showResolved ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Resolvidos
          </Button>
          <Button
            type="button" size="sm" onClick={() => setNewOpen(true)}
            className="h-9 gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Novo Chamado
          </Button>
        </div>
      </div>

      {/* CHIPS + FILTROS */}
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={statusFilter === "all"} onClick={() => updateStatus("all")}>Todos</FilterChip>
          {STATUS_FLOW.map((s) => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => updateStatus(s)}>
              {STATUS_LABEL[s]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar #, título, cliente..."
              className="h-9 w-[220px] rounded-xl pl-8 text-xs"
            />
          </div>
          <Select value={priorityFilter} onValueChange={updatePriority}>
            <SelectTrigger className="h-9 w-[140px] rounded-xl text-xs">
              <Filter className="mr-1 h-3 w-3" />
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
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

      {/* CONTEÚDO */}
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : viewMode === "kanban" ? (
          <TicketKanbanWithAssist
            tickets={filtered as any}
            showResolved={includeResolved}
            canManageStages={isAdmin}
            onAddStageClick={() => setNovaEtapaOpen(true)}
          />
        ) : (
          <TicketList tickets={filtered as any} onOpen={(id) => navigate(`/tickets/${id}`)} />
        )}
      </div>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} />
      <NovaEtapaDialog open={novaEtapaOpen} onOpenChange={setNovaEtapaOpen} />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function TicketList({ tickets, onOpen }: { tickets: any[]; onOpen: (id: string) => void }) {
  if (!tickets.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-card">
        <p className="text-sm text-muted-foreground">Nenhum chamado encontrado</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-[80px_minmax(180px,1fr)_minmax(220px,2fr)_140px_110px_140px_120px] gap-3 border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>#</span>
        <span>Cliente</span>
        <span>Título</span>
        <span>Status</span>
        <span>Prioridade</span>
        <span>Responsável</span>
        <span>Aberto</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tickets.map((t) => {
          const opened = t.opened_at ?? t.created_at;
          return (
            <button
              key={t.id} type="button" onClick={() => onOpen(t.id)}
              className="grid w-full grid-cols-[80px_minmax(180px,1fr)_minmax(220px,2fr)_140px_110px_140px_120px] items-center gap-3 border-b border-border/60 px-5 py-3 text-left text-sm transition-colors hover:bg-muted/40"
            >
              <span className="font-mono text-[12px] text-muted-foreground">#{t.ticket_number}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{t.client?.name ?? t.client_name ?? "—"}</p>
              </div>
              <p className="truncate text-foreground">{t.title}</p>
              <div><StatusBadge status={t.status} /></div>
              <div><PriorityBadge priority={t.priority} /></div>
              <span className="truncate text-xs text-muted-foreground">{t.assignee?.full_name ?? "—"}</span>
              <span className="text-xs text-muted-foreground">
                {opened ? formatDistanceToNow(new Date(opened), { locale: ptBR, addSuffix: true }) : "—"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border bg-muted/30 px-5 py-2.5 text-[11px] text-muted-foreground">
        Mostrando {tickets.length} chamado{tickets.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function TicketKanbanWithAssist({ tickets, showResolved }: { tickets: any[]; showResolved: boolean }) {
  const { data: assistedIds } = useQuery({
    queryKey: ["assist-conversation-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assist_conversations" as any).select("ticket_id");
      if (error) return new Set<string>();
      return new Set<string>(((data as any[]) ?? []).map((r: any) => r.ticket_id).filter(Boolean));
    },
    staleTime: 60_000,
  });
  return <TicketKanban tickets={tickets} showResolved={showResolved} assistedIds={assistedIds ?? new Set()} />;
}
