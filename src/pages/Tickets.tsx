import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { SLAIndicator } from "@/components/SLAIndicator";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Filter, LayoutList, KanbanSquare } from "lucide-react";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_FLOW, PRIORITY_LABEL, type TicketStatus, type TicketPriority } from "@/lib/constants";
import { timeAgo, formatBrazilDateTime } from "@/lib/formatters";
import { NewTicketDialog } from "@/components/NewTicketDialog";
import { TicketKanban } from "@/components/TicketKanban";

const VIEW_KEY = "nortear_view_chamados";

export default function Tickets() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [view, setView] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "list";
    const saved = window.localStorage.getItem(VIEW_KEY);
    return saved === "kanban" || saved === "list" ? saved : "list";
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter, debouncedQ],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("*, client:clients(id, name), assignee:profiles!assigned_to(full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") query = query.eq("status", statusFilter as TicketStatus);
      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as TicketPriority);

      if (debouncedQ) {
        const safe = debouncedQ.replace(/[%_,()]/g, " ").trim();
        const asNumber = parseInt(safe, 10);
        const orParts = [`title.ilike.%${safe}%`, `description.ilike.%${safe}%`];
        if (!isNaN(asNumber)) orParts.push(`ticket_number.eq.${asNumber}`);
        query = query.or(orParts.join(","));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filtered = tickets ?? [];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} ticket{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "kanban")}>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="gap-1.5 text-xs">
                <LayoutList className="h-3.5 w-3.5" /> Tabela
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 text-xs">
                <KanbanSquare className="h-3.5 w-3.5" /> Kanban
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setNewTicketOpen(true)} className="bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" /> Novo chamado
          </Button>
        </div>
      </div>
      <NewTicketDialog open={newTicketOpen} onOpenChange={setNewTicketOpen} />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, descrição ou #número…" className="h-9 pl-8" />
          </div>
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_FLOW.map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {view === "kanban" ? (
        isLoading ? (
          <Skeleton className="h-[60vh]" />
        ) : (
          <TicketKanban tickets={filtered as any} />
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_160px_120px_140px_120px_36px] items-center gap-3 border-b border-border bg-surface-muted px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div>#</div>
            <div>Ticket / cliente</div>
            <div>Status</div>
            <div>Prioridade</div>
            <div>SLA resolução</div>
            <div>Atualizado</div>
            <div></div>
          </div>
          {isLoading ? (
            <div className="space-y-1 p-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nenhum ticket encontrado</p>
              <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou criar um novo.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((t: any) => (
                <Link
                  key={t.id}
                  to={`/tickets/${t.id}`}
                  className="grid grid-cols-[60px_1fr_160px_120px_140px_120px_36px] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span className="font-mono text-sm font-semibold text-foreground">#{String(t.ticket_number).padStart(3, "0")}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.client?.name ?? t.client_name ?? "Sem cliente"} · {CHANNEL_LABEL[t.channel as keyof typeof CHANNEL_LABEL]}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <div>
                    {["resolvido", "fechado"].includes(t.status) ? (
                      <SLAIndicator deadline={t.sla_resolution_deadline} resolved size="sm" />
                    ) : (
                      <SLAIndicator deadline={t.sla_resolution_deadline} size="sm" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground" title={formatBrazilDateTime(t.updated_at)}>{timeAgo(t.updated_at)}</span>
                  {t.assignee ? (
                    <UserAvatar name={t.assignee.full_name} url={t.assignee.avatar_url} size="sm" />
                  ) : <span />}
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
