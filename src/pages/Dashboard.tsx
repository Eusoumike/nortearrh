import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge, PriorityBadge, HealthBadge } from "@/components/badges";
import { SLAIndicator } from "@/components/SLAIndicator";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Ticket, Users, Clock, AlertTriangle, TrendingUp, ArrowUpRight, BellRing, Download, FileSpreadsheet, FileText, Rocket, ListChecks, Calendar, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { timeAgo, formatDuration, formatBrazilDateTime } from "@/lib/formatters";
import { CHANNEL_LABEL, STATUS_LABEL, TIMED_STAGES, type TicketStatus } from "@/lib/constants";
import { isOpenStatus, isSlaOverdue, isSlaApproaching, isSlaAlerting } from "@/lib/sla";
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
  to?: string;
}

function KPI({ label, value, hint, trend, icon: Icon, tone = "primary", to }: KPIProps) {
  const toneStyles = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning dark:text-warning",
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
  }[tone];
  const interactive = to
    ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    : "";
  const card = (
    <Card className={`group relative flex h-full min-h-[140px] flex-col overflow-hidden p-5 transition-all ${interactive}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneStyles}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-auto pt-2">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {trend !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            <TrendingUp className={`h-3 w-3 ${trend >= 0 ? "text-success" : "text-danger rotate-180"}`} />
            <span className={trend >= 0 ? "text-success" : "text-danger"}>{Math.abs(trend)}%</span>
            <span className="text-muted-foreground">vs. semana anterior</span>
          </div>
        )}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block h-full">{card}</Link> : card;
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  novo: "hsl(var(--info))",
  em_atendimento: "hsl(var(--warning))",
  aguardando_cliente: "hsl(var(--muted-foreground))",
  suporte_vera_n1: "hsl(var(--accent))",
  abertura_chamado_n2: "hsl(var(--primary))",
  resolvido: "hsl(var(--success))",
  fechado: "hsl(var(--success))",
};

export default function Dashboard() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["dashboard-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, title, status, priority, opened_at, created_at, first_response_at, client_name, assigned_to, sla_deadline, sla_resolution_deadline, resolved_at, channel, current_stage_started_at, total_em_atendimento_seconds, total_aguardando_cliente_seconds, total_vera_n1_seconds, total_n2_seconds, client_id, client:clients!fk_tickets_client(id, name, health), assignee:profiles!assigned_to(full_name, avatar_url)")
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

  const { data: implCount = 0 } = useQuery({
    queryKey: ["dashboard-impl-count"],
    queryFn: async () => {
      const { count } = await supabase.from("implantacoes").select("id", { count: "exact", head: true }).neq("etapa", "finalizado");
      return count ?? 0;
    },
  });

  const { data: pendingTasks = 0 } = useQuery({
    queryKey: ["dashboard-tasks-count"],
    queryFn: async () => {
      const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "concluida");
      return count ?? 0;
    },
  });



  const stats = useMemo(() => {
    if (!tickets) return null;
    const now = Date.now();
    const open = tickets.filter((t) => isOpenStatus(t.status)).length;
    const overdue = tickets.filter((t) => isSlaOverdue(t, now)).length;

    // P5 — tickets approaching SLA: open, not overdue, ≥80% consumed
    const approachingSla = tickets.filter((t) => isSlaApproaching(t, now));

    const resolvedThisWeek = tickets.filter((t) => t.resolved_at && new Date(t.resolved_at) > new Date(now - 7 * 86400000)).length;
    const avgResponseSec = tickets
      .filter((t) => t.first_response_at)
      .map((t) => (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 1000);
    const avgResp = avgResponseSec.length ? avgResponseSec.reduce((a, b) => a + b, 0) / avgResponseSec.length : 0;

    // Status distribution — agrupa 'fechado' em 'resolvido'
    const statusList: TicketStatus[] = ["novo", "em_atendimento", "aguardando_cliente", "suporte_vera_n1", "abertura_chamado_n2", "resolvido"];
    const byStatus = statusList.map((status) => ({
      status,
      label: STATUS_LABEL[status],
      value: tickets.filter((t) => t.status === status || (status === "resolvido" && t.status === "fechado")).length,
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

    // Tempo médio por etapa (em segundos) — apenas tickets que passaram pela etapa (total > 0 ou está nela)
    const stageAverages = TIMED_STAGES.map((stage) => {
      const seconds: number[] = [];
      tickets.forEach((t: any) => {
        const total = t[stage.totalCol] ?? 0;
        const enteredAt = t[stage.enteredCol];
        const live = enteredAt ? Math.max(0, (now - new Date(enteredAt).getTime()) / 1000) : 0;
        const value = total + live;
        if (value > 0) seconds.push(value);
      });
      const avg = seconds.length ? seconds.reduce((a, b) => a + b, 0) / seconds.length : 0;
      return { key: stage.key, label: stage.label, avg, count: seconds.length };
    });

    return { open, overdue, approachingSla, resolvedThisWeek, avgResp, byStatus, days, channels, stageAverages };
  }, [tickets]);

  const recentTickets = tickets?.slice(0, 5) ?? [];

  // Clientes em atenção — agrupa por nome (client_name → organization → client.name)
  // Mostra clientes com 3+ chamados abertos OU ao menos 1 urgente/crítico aberto
  const attentionClients = useMemo(() => {
    if (!tickets) return [] as { name: string; openCount: number; hasUrgent: boolean }[];
    const isOpen = (s: string) => !["resolvido", "fechado"].includes(s);
    const buckets = new Map<string, { name: string; openCount: number; hasUrgent: boolean }>();
    tickets.filter((t: any) => isOpen(t.status)).forEach((t: any) => {
      const name = (t.client_name ?? t.organization ?? t.client?.name ?? "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      const cur = buckets.get(key) ?? { name, openCount: 0, hasUrgent: false };
      cur.openCount += 1;
      if (["urgente", "critica"].includes(t.priority)) cur.hasUrgent = true;
      buckets.set(key, cur);
    });
    return Array.from(buckets.values())
      .filter((b) => b.openCount >= 3 || b.hasUrgent)
      .sort((a, b) => Number(b.hasUrgent) - Number(a.hasUrgent) || b.openCount - a.openCount)
      .slice(0, 5);
  }, [tickets]);

  // Alertas SLA ativos (computado ao vivo) — abertos com sla_resolution_deadline,
  // que estão estourados OU já consumiram ≥80% do prazo
  const slaAlerts = useMemo(() => {
    if (!tickets) return [] as any[];
    const now = Date.now();
    return tickets
      .filter((t: any) => isSlaAlerting(t, now))
      .sort((a: any, b: any) => new Date(a.sla_resolution_deadline).getTime() - new Date(b.sla_resolution_deadline).getTime());
  }, [tickets]);

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

  const slaRate = stats.open > 0 ? Math.round(((stats.open - stats.overdue) / stats.open) * 100) : 100;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Dashboard"
        subtitle="Pulso da operação em tempo real."
        actions={
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
        }
      />

      {/* ZONA 1 — KPIs principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Chamados Abertos" value={stats.open} icon={Ticket} tone="primary" to="/tickets?open=1" />
        <KPI label="Em Implantação" value={implCount} icon={Rocket} tone="warning" to="/implantacao" />
        <KPI label="Tarefas Pendentes" value={pendingTasks} icon={ListChecks} tone="primary" to="/tarefas" />
        <KPI label="Taxa SLA" value={`${slaRate}%`} icon={CheckCircle2} tone={slaRate >= 90 ? "success" : slaRate >= 70 ? "warning" : "danger"} hint={`${stats.overdue} estourado${stats.overdue === 1 ? "" : "s"}`} to="/tickets?sla=overdue" />
      </div>

      {/* ZONA 2 — Atenção imediata */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 flex h-full min-h-[320px] flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Chamados que precisam de atenção</h2>
            <Link to="/tickets?open=1" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ver todos <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          {recentTickets.filter((t: any) => ["novo", "em_atendimento"].includes(t.status)).length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tudo em dia" description="Nenhum chamado aguardando ação." />
          ) : (
            <div className="divide-y divide-border">
              {recentTickets.filter((t: any) => ["novo", "em_atendimento"].includes(t.status)).slice(0, 6).map((t: any) => {
                const priorityColor = t.priority === "urgente" || t.priority === "critica" ? "border-l-danger" : t.priority === "alta" ? "border-l-warning" : "border-l-success";
                return (
                  <Link key={t.id} to={`/tickets/${t.id}`} className={`flex items-center gap-3 border-l-2 ${priorityColor} px-3 py-2.5 transition-colors hover:bg-surface-muted`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.client?.name ?? t.client_name ?? "Sem cliente"}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.title}</p>
                    </div>
                    <PriorityBadge priority={t.priority} />
                    <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(t.opened_at ?? t.created_at)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 flex h-full min-h-[320px] flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Atividades CRM de hoje</h2>
            <Link to="/crm/atividades" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ver todas <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          {crmToday.length === 0 ? (
            <EmptyState icon={Calendar} title="Nenhuma atividade para hoje" description="Aproveite para planejar a próxima ação." />
          ) : (
            <div className="divide-y divide-border">
              {crmToday.map((a: any) => (
                <Link key={a.id} to={a.deal_id ? `/crm/${a.deal_id}` : "/crm/atividades"} className="flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-surface-muted">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Calendar className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.titulo}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.deals?.company_name ?? "—"}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{a.agendado_para ? new Date(a.agendado_para).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>


      {/* Tempo médio por etapa */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tempo médio por etapa</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.stageAverages.map((s) => (
            <KPI
              key={s.key}
              label={s.label}
              value={s.avg > 0 ? formatDuration(s.avg) : "—"}
              hint={s.count > 0 ? `${s.count} chamado${s.count === 1 ? "" : "s"}` : "Sem dados ainda"}
              icon={Clock}
              tone="primary"
              to={`/tickets?status=${s.key}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex h-full flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Volume de tickets</h2>
              <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
            </div>
          </div>
          <div className="h-72 flex-1">
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

        <Card className="flex h-full flex-col p-5">
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

      {slaAlerts.length > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">Alertas SLA ativos</h2>
            <span className="text-xs text-muted-foreground">{slaAlerts.length} chamado{slaAlerts.length === 1 ? "" : "s"} requerendo atenção</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {slaAlerts.slice(0, 6).map((t: any) => (
              <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:bg-surface-muted">
                <span className="font-mono text-[11px] text-muted-foreground">#{t.ticket_number}</span>
                <p className="flex-1 truncate text-sm font-medium">{t.title}</p>
                <SLAIndicator deadline={t.sla_resolution_deadline} size="sm" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex h-full min-h-[360px] flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tickets recentes</h2>
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
                <span className="shrink-0 rounded-md border border-border bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                  #{String(t.ticket_number).padStart(3, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground" title={formatBrazilDateTime(t.opened_at ?? t.created_at)}>
                    {t.client?.name ?? t.client_name ?? "Sem cliente"} · {timeAgo(t.opened_at ?? t.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  {!["resolvido", "fechado"].includes(t.status) && (
                    <>
                      <StatusBadge status={t.status} />
                      {t.sla_resolution_deadline && (
                        <SLAIndicator deadline={t.sla_resolution_deadline} size="sm" />
                      )}
                    </>
                  )}
                  {t.assignee && <UserAvatar name={t.assignee.full_name} url={t.assignee.avatar_url} size="sm" />}
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="flex h-full min-h-[360px] flex-col p-5">
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
                <Link
                  key={c.name}
                  to={`/tickets?client=${encodeURIComponent(c.name)}&open=1`}
                  className="block rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.hasUrgent ? (
                      <HealthBadge health="critico" />
                    ) : (
                      <HealthBadge health="em_atencao" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.openCount} chamado{c.openCount === 1 ? "" : "s"} aberto{c.openCount === 1 ? "" : "s"}
                    {c.hasUrgent ? " · ao menos 1 urgente" : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
