import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge, PriorityBadge, HealthBadge } from "@/components/badges";
import { SLAIndicator } from "@/components/SLAIndicator";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, Users, Clock, AlertTriangle, TrendingUp, ArrowUpRight, BellRing, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { timeAgo, formatDuration } from "@/lib/formatters";
import { CHANNEL_LABEL, type TicketStatus } from "@/lib/constants";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { useMemo } from "react";
import { exportTicketsCsv, exportTicketsPdf, type ExportTicket } from "@/lib/exporters";

interface KPIProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "warning" | "danger" | "success";
}

function KPI({ label, value, hint, trend, icon: Icon, tone = "primary" }: KPIProps) {
  const toneStyles = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning dark:text-warning",
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <Card className="group relative overflow-hidden p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${toneStyles}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <TrendingUp className={`h-3 w-3 ${trend >= 0 ? "text-success" : "text-danger rotate-180"}`} />
          <span className={trend >= 0 ? "text-success" : "text-danger"}>{Math.abs(trend)}%</span>
          <span className="text-muted-foreground">vs. semana anterior</span>
        </div>
      )}
    </Card>
  );
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  aberto: "hsl(var(--info))",
  em_andamento: "hsl(var(--warning))",
  aguardando_cliente: "hsl(var(--muted-foreground))",
  resolvido: "hsl(var(--success))",
  fechado: "hsl(var(--muted))",
};

export default function Dashboard() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["dashboard-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, client:clients(id, name, health), assignee:profiles!assigned_to(full_name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["dashboard-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, health, health_reason").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    if (!tickets) return null;
    const now = Date.now();
    const isOpen = (s: string) => !["resolvido", "fechado"].includes(s);
    const open = tickets.filter((t) => isOpen(t.status)).length;
    const overdue = tickets.filter((t) => t.sla_resolution_deadline && new Date(t.sla_resolution_deadline).getTime() < now && isOpen(t.status)).length;

    // P5 — tickets approaching SLA: open, not overdue, ≥80% consumed
    const approachingSla = tickets.filter((t) => {
      if (!isOpen(t.status) || !t.sla_resolution_deadline) return false;
      const created = new Date(t.created_at).getTime();
      const deadline = new Date(t.sla_resolution_deadline).getTime();
      const total = deadline - created;
      if (total <= 0) return false;
      const consumed = now - created;
      const ratio = consumed / total;
      return ratio >= 0.8 && now < deadline;
    });

    const resolvedThisWeek = tickets.filter((t) => t.resolved_at && new Date(t.resolved_at) > new Date(now - 7 * 86400000)).length;
    const avgResponseSec = tickets
      .filter((t) => t.first_response_at)
      .map((t) => (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 1000);
    const avgResp = avgResponseSec.length ? avgResponseSec.reduce((a, b) => a + b, 0) / avgResponseSec.length : 0;

    // Status distribution
    const byStatus = (["aberto", "em_andamento", "aguardando_cliente", "resolvido", "fechado"] as TicketStatus[]).map((status) => ({
      status,
      label: status,
      value: tickets.filter((t) => t.status === status).length,
    }));

    // Volume últimos 14 dias
    const days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d.getTime() + 86400000);
      const count = tickets.filter((t) => {
        const tc = new Date(t.created_at);
        return tc >= d && tc < next;
      }).length;
      days.push({ date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), count });
    }

    // Por canal
    const byChannel: Record<string, number> = {};
    tickets.forEach((t) => {
      byChannel[t.channel] = (byChannel[t.channel] || 0) + 1;
    });
    const channels = Object.entries(byChannel).map(([k, v]) => ({ name: CHANNEL_LABEL[k as keyof typeof CHANNEL_LABEL] ?? k, value: v }));

    return { open, overdue, approachingSla, resolvedThisWeek, avgResp, byStatus, days, channels };
  }, [tickets]);

  const recentTickets = tickets?.slice(0, 6) ?? [];
  const attentionClients = clients?.filter((c) => c.health !== "saudavel").slice(0, 5) ?? [];

  const handleExport = (kind: "csv" | "pdf") => {
    if (!tickets || !stats) return;
    const data: ExportTicket[] = tickets.map((t: any) => ({
      ticket_number: t.ticket_number,
      title: t.title,
      ticket_type: t.ticket_type ?? null,
      status: t.status,
      priority: t.priority,
      channel: t.channel,
      client_name: t.client?.name ?? null,
      created_at: t.created_at,
      resolved_at: t.resolved_at,
      sla_resolution_deadline: t.sla_resolution_deadline,
    }));
    if (kind === "csv") {
      exportTicketsCsv(data);
    } else {
      exportTicketsPdf(data, {
        open: stats.open,
        overdue: stats.overdue,
        resolved: stats.resolvedThisWeek,
        avgRespHrs: stats.avgResp ? formatDuration(stats.avgResp) : "—",
      });
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Pulso da operação em tempo real.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("csv")}>
              <FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Exportar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("pdf")}>
              <FileText className="mr-2 h-3.5 w-3.5" /> Exportar PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KPI label="Tickets abertos" value={stats.open} icon={Ticket} tone="primary" />
        <KPI label="SLA estourado" value={stats.overdue} icon={AlertTriangle} tone="danger" hint={stats.overdue === 0 ? "Tudo dentro do prazo." : "Requer atenção"} />
        <KPI label="Próximos do SLA" value={stats.approachingSla.length} icon={BellRing} tone="warning" hint=">80% do prazo consumido" />
        <KPI label="Resolvidos (7d)" value={stats.resolvedThisWeek} icon={TrendingUp} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Volume de tickets</h2>
              <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.days}>
                <defs>
                  <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#volume)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Distribuição por status</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.byStatus} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                  {stats.byStatus.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {stats.byStatus.filter((s) => s.value > 0).map((s) => (
              <div key={s.status} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                  <StatusBadge status={s.status} />
                </span>
                <span className="font-mono font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {stats.approachingSla.length > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">Alertas SLA ativos</h2>
            <span className="text-xs text-muted-foreground">{stats.approachingSla.length} chamado{stats.approachingSla.length === 1 ? "" : "s"} próximo{stats.approachingSla.length === 1 ? "" : "s"} do prazo</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {stats.approachingSla.slice(0, 6).map((t: any) => (
              <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:bg-surface-muted">
                <span className="font-mono text-[11px] text-muted-foreground">#{t.ticket_number}</span>
                <p className="flex-1 truncate text-sm font-medium">{t.title}</p>
                <SLAIndicator deadline={t.sla_resolution_deadline} size="sm" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">

            <Link to="/tickets" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="-mx-2 divide-y divide-border">
            {recentTickets.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum ticket ainda. Crie o primeiro!</p>
            )}
            {recentTickets.map((t: any) => (
              <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-muted">
                <span className="font-mono text-[11px] text-muted-foreground w-12">#{t.ticket_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.client?.name ?? "Sem cliente"} · {timeAgo(t.created_at)}</p>
                </div>
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                {!["resolvido", "fechado"].includes(t.status) && t.sla_resolution_deadline && (
                  <SLAIndicator deadline={t.sla_resolution_deadline} size="sm" />
                )}
                {t.assignee && <UserAvatar name={t.assignee.full_name} url={t.assignee.avatar_url} size="sm" />}
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Clientes em atenção</h2>
          {attentionClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                <Users className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-medium">Tudo em ordem</p>
              <p className="text-xs text-muted-foreground">Nenhum cliente sinalizado.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {attentionClients.map((c) => (
                <Link key={c.id} to={`/clientes/${c.id}`} className="block rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-muted">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <HealthBadge health={c.health} />
                  </div>
                  {c.health_reason && <p className="line-clamp-2 text-xs text-muted-foreground">{c.health_reason}</p>}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
