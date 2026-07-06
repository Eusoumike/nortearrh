import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { formatDuration, timeAgo } from "@/lib/formatters";
import {
  Ticket as TicketIcon,
  Clock,
  TrendingUp,
  Rocket,
  AlertTriangle,
  ChevronRight,
  CalendarDays,
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";
import { InsightsChamados } from "@/components/dashboard/InsightsChamados";

/* ============================================================
 * Helpers
 * ========================================================== */
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const startOfPeriod = (p: "dia" | "semana" | "mes") => {
  const d = new Date();
  if (p === "dia") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (p === "semana") {
    const w = new Date();
    w.setHours(0, 0, 0, 0);
    w.setDate(w.getDate() - 7);
    return w;
  }
  return startOfMonth();
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const longDate = () =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

const ETAPA_LABEL: Record<string, string> = {
  novo_cliente: "Kick-off",
  boas_vindas: "Boas-vindas",
  treinamento_1: "Treinamento 1",
  treinamento_2: "Treinamento 2",
  treinamento_3: "Treinamento 3",
  finalizado: "Go-live",
};

/* ============================================================
 * KPI Card
 * ========================================================== */
function KpiCard({
  label,
  value,
  badge,
  badgeTone,
  children,
}: {
  label: string;
  value: string | number;
  badge?: string;
  badgeTone?: "primary" | "success" | "warning" | "danger";
  children?: React.ReactNode;
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-danger/10 text-danger",
  }[badgeTone ?? "primary"];

  return (
    <Card className="group relative flex h-40 flex-col justify-between overflow-hidden border-border/70 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        {badge && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", toneCls)}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-[40px] font-extrabold leading-none tracking-tight text-foreground">
          {value}
        </p>
      </div>
      <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">{children}</div>
    </Card>
  );
}

/* ============================================================
 * Dashboard
 * ========================================================== */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"dia" | "semana" | "mes">("dia");

  const userName = (user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "").split(" ")[0];

  /* ------- Tickets ------- */
  const { data: tickets, isLoading: loadingT } = useQuery({
    queryKey: ["dash-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_number, title, status, priority, created_at, resolved_at, first_response_at, sla_resolution_deadline, client_name, organization")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ------- Implantações ------- */
  const { data: implantacoes, isLoading: loadingI } = useQuery({
    queryKey: ["dash-impl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("id, client_name, etapa, health_status, data_ultima_transicao, data_inicio")
        .neq("etapa", "finalizado")
        .order("data_ultima_transicao", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ------- Clients ------- */
  const { data: clients } = useQuery({
    queryKey: ["dash-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, status_nortear");
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ------- Parcelas em atraso ------- */
  const { data: parcelasAtraso } = useQuery({
    queryKey: ["dash-parcelas-atraso"],
    queryFn: async () => {
      const firstOfMonth = startOfMonth().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select("id, cliente_nome, valor_mensalidade, competencia")
        .eq("status", "pendente")
        .lt("competencia", firstOfMonth)
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ------- Tarefas hoje ------- */
  const { data: tarefasHoje } = useQuery({
    queryKey: ["dash-tarefas-hoje"],
    queryFn: async () => {
      const today = startOfToday().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, ticket_id, status")
        .eq("due_date", today)
        .neq("status", "concluida")
        .order("created_at", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ------- Métricas computadas ------- */
  const periodStart = startOfPeriod(period);

  const kpis = useMemo(() => {
    const all = tickets ?? [];
    const abertos = all.filter((t: any) =>
      ["novo", "em_atendimento", "aguardando_cliente", "suporte_vera_n1", "abertura_chamado_n2"].includes(t.status),
    );
    const criticos = abertos.filter((t: any) => ["urgente", "critica", "alta"].includes(t.priority)).length;
    const normais = abertos.length - criticos;
    const novosHoje = abertos.filter((t: any) => new Date(t.created_at) >= startOfToday()).length;

    // TMA: tempo médio created → resolved no período
    const resolvedPeriod = all.filter(
      (t: any) => t.resolved_at && new Date(t.resolved_at) >= periodStart,
    );
    const tmaSec = resolvedPeriod.length
      ? resolvedPeriod.reduce(
          (acc: number, t: any) =>
            acc + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 1000,
          0,
        ) / resolvedPeriod.length
      : 0;

    // Total criados no mês
    const startMonth = startOfMonth();
    const totalMes = all.filter((t: any) => new Date(t.created_at) >= startMonth).length;

    return {
      abertos: abertos.length,
      criticos,
      normais,
      novosHoje,
      tmaSec,
      tmaCount: resolvedPeriod.length,
      totalMes,
    };
  }, [tickets, period, periodStart]);

  const implStats = useMemo(() => {
    const list = implantacoes ?? [];
    const total = list.length;
    const emRisco = list.filter((i: any) => i.health_status !== "no_prazo").length;
    const saudaveis = total - emRisco;
    const pct = total > 0 ? Math.round((saudaveis / total) * 100) : 0;
    return { total, emRisco, pct };
  }, [implantacoes]);

  const carteira = useMemo(() => {
    const list = clients ?? [];
    const total = list.length || 1;
    const ativos = list.filter((c: any) => c.status_nortear === "ativo_saudavel").length;
    const risco = list.filter((c: any) => c.status_nortear === "em_risco").length;
    const cancel = list.filter((c: any) => c.status_nortear === "risco_cancelamento").length;
    return {
      total: list.length,
      ativos,
      risco,
      cancel,
      pAtivos: Math.round((ativos / total) * 100),
      pRisco: Math.round((risco / total) * 100),
      pCancel: Math.round((cancel / total) * 100),
    };
  }, [clients]);

  /* ------- Stepper agregado ------- */
  const stepperEtapas = useMemo(() => {
    const list = implantacoes ?? [];
    const counts: Record<string, number> = {
      kickoff: 0,
      configuracao: 0,
      treinamento: 0,
      golive: 0,
    };
    list.forEach((i: any) => {
      if (i.etapa === "novo_cliente" || i.etapa === "boas_vindas") counts.kickoff++;
      else if (i.etapa === "treinamento_1") counts.configuracao++;
      else if (i.etapa === "treinamento_2" || i.etapa === "treinamento_3") counts.treinamento++;
    });
    return [
      { key: "kickoff", label: "Kick-off", count: counts.kickoff },
      { key: "configuracao", label: "Configuração", count: counts.configuracao },
      { key: "treinamento", label: "Treinamento", count: counts.treinamento },
      { key: "golive", label: "Go-live", count: 0 },
    ];
  }, [implantacoes]);

  /* ------- Atenção imediata ------- */
  const atencao = useMemo(() => {
    const items: Array<{
      id: string;
      tone: "danger" | "warning" | "primary";
      title: string;
      subtitle: string;
      href: string;
    }> = [];

    const now = Date.now();
    (tickets ?? [])
      .filter(
        (t: any) =>
          ["novo", "em_atendimento"].includes(t.status) &&
          t.sla_resolution_deadline &&
          new Date(t.sla_resolution_deadline).getTime() - now < 3600 * 1000 * 4,
      )
      .slice(0, 3)
      .forEach((t: any) =>
        items.push({
          id: `tk-${t.id}`,
          tone: "danger",
          title: t.title,
          subtitle: `${t.client_name ?? t.organization ?? "—"} · SLA ${timeAgo(t.sla_resolution_deadline)}`,
          href: `/tickets/${t.id}`,
        }),
      );

    (implantacoes ?? [])
      .filter((i: any) => i.health_status === "atrasado")
      .slice(0, 2)
      .forEach((i: any) =>
        items.push({
          id: `im-${i.id}`,
          tone: "warning",
          title: i.client_name,
          subtitle: `Implantação parada em ${ETAPA_LABEL[i.etapa] ?? i.etapa}`,
          href: `/implantacao`,
        }),
      );

    (parcelasAtraso ?? []).slice(0, 2).forEach((p: any) =>
      items.push({
        id: `pa-${p.id}`,
        tone: "primary",
        title: p.cliente_nome ?? "—",
        subtitle: `Parcela em atraso · R$ ${Number(p.valor_mensalidade || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        href: `/financeiro`,
      }),
    );

    return items;
  }, [tickets, implantacoes, parcelasAtraso]);

  /* ------- AI insight (heurística) ------- */
  const insight = useMemo(() => {
    if (implStats.emRisco >= 3)
      return `${implStats.emRisco} implantações sem progresso há mais de 7 dias. Recomenda-se reunião de desbloqueio.`;
    if (kpis.criticos >= 3)
      return `${kpis.criticos} chamados de alta prioridade abertos simultaneamente. Possível pico de demanda.`;
    if (carteira.cancel > 0)
      return `${carteira.cancel} cliente${carteira.cancel > 1 ? "s" : ""} em risco de cancelamento. Contato proativo recomendado.`;
    return "Operação dentro dos parâmetros normais nas últimas 24h. Sem anomalias detectadas.";
  }, [implStats, kpis, carteira]);

  const loading = loadingT || loadingI;

  return (
    <div className="relative min-h-full bg-background">
      <div className="mx-auto w-full max-w-[1440px] space-y-8 p-6 md:p-8">
        {/* Page header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-[32px]">
              {greeting()}, {userName || "Maykon"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
              {longDate()} · Monitorando o{" "}
              <span className="font-semibold text-primary">fluxo de operações</span> em tempo real
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            {(["dia", "semana", "mes"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
                  period === p
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p === "mes" ? "Mês" : p}
              </button>
            ))}
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </>
          ) : (
            <>
              <KpiCard
                label="Chamados Abertos"
                value={kpis.abertos}
                badge={kpis.novosHoje > 0 ? `+${kpis.novosHoje} hoje` : undefined}
                badgeTone="primary"
              >
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-danger" />
                    {kpis.criticos} Críticos
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    {kpis.normais} Normais
                  </span>
                </div>
              </KpiCard>

              <KpiCard
                label="TMA"
                value={kpis.tmaSec > 0 ? formatDuration(kpis.tmaSec) : "—"}
                badge={kpis.tmaCount > 0 ? `${kpis.tmaCount} resolvidos` : undefined}
                badgeTone="success"
              >
                Tempo médio de resolução {period === "dia" ? "hoje" : period === "semana" ? "nos últimos 7d" : "no mês"}.
              </KpiCard>

              <KpiCard label="Total de Chamados" value={kpis.totalMes}>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span>Meta mensal</span>
                    <span className="font-mono font-semibold text-foreground">
                      {Math.min(100, Math.round((kpis.totalMes / 150) * 100))}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.round((kpis.totalMes / 150) * 100))}%` }}
                    />
                  </div>
                </div>
              </KpiCard>

              <KpiCard
                label="Implantações Ativas"
                value={implStats.total}
                badge={implStats.emRisco > 0 ? `${implStats.emRisco} em risco` : undefined}
                badgeTone="warning"
              >
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span>Saudáveis</span>
                    <span className="font-mono font-semibold text-foreground">{implStats.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${implStats.pct}%` }}
                    />
                  </div>
                </div>
              </KpiCard>
            </>
          )}
        </section>

        {/* Main 2-col layout */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
          {/* LEFT */}
          <div className="space-y-6">
            {/* Processo de implantação */}
            <Card className="border-border/70 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight">Processo de Implantação</h2>
                <Link
                  to="/implantacao"
                  className="text-[11px] font-bold uppercase tracking-wider text-primary hover:underline"
                >
                  Ver detalhes →
                </Link>
              </div>

              {/* Stepper */}
              <div className="mb-6 flex items-center">
                {stepperEtapas.map((s, idx) => {
                  const active = s.count > 0;
                  return (
                    <div key={s.key} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {active ? s.count : <Circle className="h-3 w-3" />}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {s.label}
                        </span>
                      </div>
                      {idx < stepperEtapas.length - 1 && (
                        <div className="mx-2 mb-5 h-px flex-1 bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Lista resumida */}
              <div className="divide-y divide-border/60 border-t border-border/60">
                {(implantacoes ?? []).slice(0, 3).map((i: any) => (
                  <div
                    key={i.id}
                    onClick={() => navigate("/implantacao")}
                    className="group flex cursor-pointer items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{i.client_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Estágio:{" "}
                        <span className="font-semibold text-primary">
                          {ETAPA_LABEL[i.etapa] ?? i.etapa}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Última transição
                        </p>
                        <p className="text-xs text-foreground">
                          {i.data_ultima_transicao ? timeAgo(i.data_ultima_transicao) : "—"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                ))}
                {(implantacoes ?? []).length === 0 && !loadingI && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma implantação ativa no momento.
                  </p>
                )}
              </div>
            </Card>

            {/* Atenção Imediata */}
            <Card className="overflow-hidden border-border/70">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-6 py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  <h2 className="text-lg font-bold tracking-tight">Atenção Imediata</h2>
                </div>
                <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-danger">
                  {atencao.length} pendência{atencao.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {atencao.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Nada pedindo atenção agora. ✨
                  </p>
                ) : (
                  atencao.map((a) => {
                    const borderCls = {
                      danger: "border-l-danger",
                      warning: "border-l-warning",
                      primary: "border-l-primary",
                    }[a.tone];
                    return (
                      <Link
                        key={a.id}
                        to={a.href}
                        className={cn(
                          "group flex items-center justify-between gap-3 border-l-4 px-6 py-4 transition-colors hover:bg-muted/40",
                          borderCls,
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.subtitle}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </Link>
                    );
                  })
                )}
              </div>

              {atencao.length > 0 && (
                <Link
                  to="/tickets"
                  className="block border-t border-border/60 px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-primary hover:bg-muted/40"
                >
                  Gerenciar todos os pendentes
                </Link>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            {/* Agenda */}
            <Card className="border-border/70 p-6">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold tracking-tight">Agenda do Dia</h2>
              </div>

              {(tarefasHoje ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma tarefa agendada para hoje.
                </p>
              ) : (
                <ol className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {(tarefasHoje ?? []).map((t: any) => (
                    <li
                      key={t.id}
                      className="group relative flex cursor-pointer gap-3 pl-6"
                      onClick={() => navigate(t.ticket_id ? `/tickets/${t.ticket_id}` : "/tarefas")}
                    >
                      <span className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-card" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
                          Hoje
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                          {t.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.status === "em_andamento" ? "Em andamento" : "A fazer"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <Button
                variant="outline"
                size="sm"
                className="mt-5 w-full text-[11px] font-bold uppercase tracking-wider"
                onClick={() => navigate("/tarefas")}
              >
                + Agendar atividade
              </Button>
            </Card>

            {/* AI Assist */}
            <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-6">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-primary">
                    AI Assist Insights
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  <span className="font-bold">Anomalia detectada:</span> {insight}
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <button
                    onClick={() => navigate("/tickets")}
                    className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                  >
                    Abrir chamados
                  </button>
                  <button className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                    Dispensar
                  </button>
                </div>
              </div>
            </Card>

            {/* Saúde da Carteira */}
            <Card className="border-border/70 p-6">
              <h2 className="mb-4 text-base font-bold tracking-tight">Saúde da Carteira</h2>

              <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500" style={{ width: `${carteira.pAtivos}%` }} />
                <div className="bg-orange-400" style={{ width: `${carteira.pRisco}%` }} />
                <div className="bg-danger" style={{ width: `${carteira.pCancel}%` }} />
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Ativos</span>
                  <span className="ml-auto font-mono font-semibold text-foreground">{carteira.pAtivos}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  <span className="text-muted-foreground">Em risco</span>
                  <span className="ml-auto font-mono font-semibold text-foreground">{carteira.pRisco}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  <span className="text-muted-foreground">Cancelamento</span>
                  <span className="ml-auto font-mono font-semibold text-foreground">{carteira.pCancel}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Total</span>
                  <span className="ml-auto font-mono font-semibold text-foreground">{carteira.total}</span>
                </div>
              </div>

              {carteira.cancel > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <p className="text-xs text-foreground">
                    Recomenda-se contato proativo imediato para{" "}
                    <span className="font-bold">{carteira.cancel}</span>{" "}
                    cliente{carteira.cancel > 1 ? "s" : ""}.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>

      {/* FAB */}
      <div className="group fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <div className="flex flex-col items-end gap-2 opacity-0 transition-all duration-200 group-hover:opacity-100">
          <button
            onClick={() => navigate("/tickets/novo")}
            className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-bold text-background shadow-2xl transition-transform hover:scale-105"
          >
            <TicketIcon className="h-3.5 w-3.5" /> Novo chamado
          </button>
          <button
            onClick={() => navigate("/implantacao")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-2xl transition-transform hover:scale-105"
          >
            <Rocket className="h-3.5 w-3.5" /> Nova implantação
          </button>
          <button
            onClick={() => navigate("/clientes")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-2xl transition-transform hover:scale-105"
          >
            <Search className="h-3.5 w-3.5" /> Buscar CNPJ
          </button>
        </div>
        <button className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform duration-300 group-hover:rotate-45">
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
