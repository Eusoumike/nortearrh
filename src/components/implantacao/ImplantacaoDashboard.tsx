import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = { key: string; label: string; tone: any };

function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export type ImplFilter = "todas" | "no_prazo" | "em_risco" | "atrasadas";

interface DashboardData {
  stages: Stage[];
  finalKey: string;
}

/** KPI strip + at-risk banner shown above the kanban. */
export function ImplantacaoKpiHeader({
  stages,
  onJumpRisk,
}: {
  stages: Stage[];
  onJumpRisk?: () => void;
}) {
  const { items, checklistMap, finalKey } = useDashboardData(stages);

  const kpis = useMemo(() => {
    const active = items.filter((i) => i.etapa !== finalKey);
    const total = active.length;

    // TTV: média de dias desde data_inicio para implantações finalizadas
    const finalized = items.filter((i) => i.etapa === finalKey && i.data_inicio);
    const ttvDays = finalized.length
      ? Math.round(
          finalized.reduce((acc, i) => {
            const start = new Date(i.data_inicio + "T12:00:00-03:00").getTime();
            const end = new Date(i.updated_at ?? i.created_at).getTime();
            return acc + Math.max(0, (end - start) / 86_400_000);
          }, 0) / finalized.length,
        )
      : null;

    // Taxa de conclusão média do checklist nas ativas
    const completion = (() => {
      if (!total) return 0;
      const pcts = active.map((i) => {
        const c = checklistMap.get(i.id);
        if (!c || c.total === 0) return 0;
        return (c.done / c.total) * 100;
      });
      return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    })();

    // Em risco: ativas com >14 dias sem atualização OU > 21 dias desde início
    const atRisk = active.filter((i) => {
      const stale = daysBetween(i.updated_at) ?? 0;
      const total = daysBetween(i.created_at) ?? 0;
      return stale > 14 || total > 21;
    });

    const newThisMonth = items.filter((i) => {
      const d = new Date(i.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return { total, ttvDays, completion, atRisk, newThisMonth };
  }, [items, checklistMap, finalKey]);

  const worstAtRisk = kpis.atRisk
    .map((i) => ({ ...i, stale: daysBetween(i.updated_at) ?? 0 }))
    .sort((a, b) => b.stale - a.stale)[0];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Implantações ativas"
          value={kpis.total.toString()}
          delta={kpis.newThisMonth > 0 ? `+${kpis.newThisMonth} este mês` : "—"}
          deltaTone="primary"
          icon={<Activity className="h-4 w-4" />}
        />
        <KpiCard
          label="TTV médio"
          value={kpis.ttvDays !== null ? `${kpis.ttvDays} dias` : "—"}
          delta="Meta: 7 dias"
          deltaTone="accent"
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          label="Taxa de conclusão"
          value={`${kpis.completion}%`}
          delta="checklist médio"
          deltaTone="success"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          label="Em risco"
          value={kpis.atRisk.length.toString()}
          delta="atraso > 14 dias"
          deltaTone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={kpis.atRisk.length > 0}
        />
      </div>

      {kpis.atRisk.length > 0 && worstAtRisk && (
        <button
          type="button"
          onClick={onJumpRisk}
          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-left transition-colors hover:bg-warning/15"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {kpis.atRisk.length} {kpis.atRisk.length === 1 ? "implantação" : "implantações"} com risco de atraso
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <strong>{worstAtRisk.client_name}</strong> está parada há {worstAtRisk.stale} dias
                {worstAtRisk.etapa ? ` na etapa ${stages.find((s) => s.key === worstAtRisk.etapa)?.label ?? worstAtRisk.etapa}` : ""}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-warning group-hover:underline">
            Ver detalhes
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </button>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  icon,
  accent,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone: "primary" | "accent" | "success" | "danger";
  icon: React.ReactNode;
  accent?: boolean;
}) {
  const toneClass = {
    primary: "text-primary",
    accent: "text-accent",
    success: "text-success",
    danger: "text-danger",
  }[deltaTone];

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-shadow hover:shadow-md",
        accent ? "border-danger/40 bg-danger/5" : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={cn("rounded-md bg-muted/60 p-1.5", toneClass)}>{icon}</span>
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", accent && "text-danger")}>{value}</p>
      <p className={cn("mt-1 text-xs font-medium", toneClass)}>{delta}</p>
    </Card>
  );
}

// ============================================================
// SIDEBAR — Atividades, Tempo por etapa, Health donut
// ============================================================

export function ImplantacaoSideStack({ stages }: { stages: Stage[] }) {
  const { items, checklistMap, finalKey } = useDashboardData(stages);

  const todayItems = useMemo(() => {
    // top 4 ativas que mais precisam de atenção (mais tempo sem atualização)
    return items
      .filter((i) => i.etapa !== finalKey)
      .map((i) => ({ ...i, stale: daysBetween(i.updated_at) ?? 0 }))
      .sort((a, b) => b.stale - a.stale)
      .slice(0, 4);
  }, [items, finalKey]);

  const stageAvg = useMemo(() => {
    const buckets = new Map<string, number[]>();
    items
      .filter((i) => i.etapa !== finalKey)
      .forEach((i) => {
        const d = daysBetween(i.updated_at);
        if (d === null) return;
        const arr = buckets.get(i.etapa) ?? [];
        arr.push(d);
        buckets.set(i.etapa, arr);
      });
    const rows = stages
      .filter((s) => s.key !== finalKey)
      .map((s) => {
        const arr = buckets.get(s.key) ?? [];
        const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        return { key: s.key, label: s.label, avg: Math.round(avg) };
      });
    const max = Math.max(...rows.map((r) => r.avg), 1);
    const slowest = rows.reduce((best, r) => (r.avg > best.avg ? r : best), rows[0] ?? { avg: 0, key: "" });
    return { rows, max, slowestKey: slowest?.key };
  }, [items, stages, finalKey]);

  const health = useMemo(() => {
    const active = items.filter((i) => i.etapa !== finalKey);
    let on = 0, risk = 0, late = 0;
    active.forEach((i) => {
      const stale = daysBetween(i.updated_at) ?? 0;
      const total = daysBetween(i.created_at) ?? 0;
      if (total > 21 || stale > 21) late++;
      else if (stale > 14) risk++;
      else on++;
    });
    return { on, risk, late, total: active.length };
  }, [items, finalKey]);

  return (
    <div className="flex flex-col gap-3">
      {/* Atividades de hoje */}
      <Card className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Precisam de atenção hoje</h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Top {todayItems.length}
          </span>
        </div>
        <ul className="space-y-2">
          {todayItems.length === 0 && (
            <li className="rounded-md bg-muted/40 p-3 text-center text-xs text-muted-foreground">
              Tudo em dia 🎉
            </li>
          )}
          {todayItems.map((i) => {
            const c = checklistMap.get(i.id);
            const pct = c && c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <li
                key={i.id}
                className="rounded-md border border-border bg-surface px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <p className="truncate text-xs font-semibold">{i.client_name}</p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {stages.find((s) => s.key === i.etapa)?.label ?? i.etapa}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono font-medium",
                      i.stale > 14 ? "text-danger" : i.stale > 7 ? "text-warning" : "text-muted-foreground",
                    )}
                  >
                    {i.stale === 0 ? "hoje" : `${i.stale}d`} · {pct}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Tempo médio por etapa */}
      <Card className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tempo médio por etapa</h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">dias</span>
        </div>
        <ul className="space-y-2.5">
          {stageAvg.rows.map((r) => {
            const slow = r.key === stageAvg.slowestKey && r.avg > 0;
            const w = `${Math.max(2, (r.avg / stageAvg.max) * 100)}%`;
            return (
              <li key={r.key}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="truncate text-muted-foreground">{r.label}</span>
                  <span className={cn("font-mono font-semibold", slow ? "text-warning" : "text-foreground")}>
                    {r.avg}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", slow ? "bg-warning" : "bg-primary/70")}
                    style={{ width: w }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Health donut */}
      <Card className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Health score dos clientes</h3>
        <div className="flex items-center gap-4">
          <HealthDonut on={health.on} risk={health.risk} late={health.late} />
          <ul className="flex-1 space-y-1.5 text-xs">
            <HealthRow color="bg-success" label="No prazo" value={health.on} />
            <HealthRow color="bg-warning" label="Em risco" value={health.risk} />
            <HealthRow color="bg-danger" label="Atrasados" value={health.late} />
          </ul>
        </div>
      </Card>
    </div>
  );
}

function HealthRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className="font-mono font-semibold">{value}</span>
    </li>
  );
}

function HealthDonut({ on, risk, late }: { on: number; risk: number; late: number }) {
  const total = on + risk + late || 1;
  const r = 32;
  const c = 2 * Math.PI * r;
  const seg = (v: number) => (v / total) * c;
  const onLen = seg(on);
  const riskLen = seg(risk);
  const lateLen = seg(late);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--success))" strokeWidth="10"
          strokeDasharray={`${onLen} ${c - onLen}`} strokeDashoffset="0"
        />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--warning))" strokeWidth="10"
          strokeDasharray={`${riskLen} ${c - riskLen}`} strokeDashoffset={-onLen}
        />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--danger))" strokeWidth="10"
          strokeDasharray={`${lateLen} ${c - lateLen}`} strokeDashoffset={-(onLen + riskLen)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold leading-none">{total}</span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">clientes</span>
      </div>
    </div>
  );
}

// ============================================================
// Filter chips
// ============================================================

export function ImplantacaoFilterChips({
  value,
  onChange,
  counts,
}: {
  value: ImplFilter;
  onChange: (v: ImplFilter) => void;
  counts: { todas: number; no_prazo: number; em_risco: number; atrasadas: number };
}) {
  const chips: { v: ImplFilter; label: string; tone: string }[] = [
    { v: "todas", label: "Todas", tone: "neutral" },
    { v: "no_prazo", label: "No prazo", tone: "success" },
    { v: "em_risco", label: "Em risco", tone: "warning" },
    { v: "atrasadas", label: "Atrasadas", tone: "danger" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const active = value === c.v;
        const n = counts[c.v];
        return (
          <button
            key={c.v}
            type="button"
            onClick={() => onChange(c.v)}
            className={cn(
              "rounded-full border px-3.5 py-1 text-xs font-medium transition-colors",
              !active && "border-border text-muted-foreground hover:bg-muted",
              active && c.tone === "neutral" && "bg-foreground text-background border-foreground",
              active && c.tone === "success" && "bg-success/15 border-success/40 text-success",
              active && c.tone === "warning" && "bg-warning/15 border-warning/40 text-warning",
              active && c.tone === "danger" && "bg-danger/15 border-danger/40 text-danger",
            )}
          >
            {c.label} <span className="ml-1 opacity-70">({n})</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Shared data hook
// ============================================================

function useDashboardData(stages: Stage[]): {
  items: any[];
  checklistMap: Map<string, { done: number; total: number }>;
  finalKey: string;
} {
  const { data: items = [] } = useQuery({
    queryKey: ["implantacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("id, client_name, etapa, data_inicio, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ["checklist-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("implantacao_id, concluido");
      if (error) throw error;
      return data ?? [];
    },
  });

  const checklistMap = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    checklist.forEach((c: any) => {
      const cur = m.get(c.implantacao_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (c.concluido) cur.done += 1;
      m.set(c.implantacao_id, cur);
    });
    return m;
  }, [checklist]);

  // a etapa "final" é a última visível (geralmente "finalizado")
  const finalKey = stages[stages.length - 1]?.key ?? "finalizado";

  return { items, checklistMap, finalKey };
}

/** Hook usado pelo kanban para aplicar o filtro selecionado. */
export function useImplFilter(items: any[], filter: ImplFilter, finalKey: string) {
  return useMemo(() => {
    if (filter === "todas") return items;
    return items.filter((i) => {
      if (i.etapa === finalKey) return false;
      const stale = daysBetween(i.updated_at) ?? 0;
      const total = daysBetween(i.created_at) ?? 0;
      const status: Exclude<ImplFilter, "todas"> =
        total > 21 || stale > 21 ? "atrasadas" : stale > 14 ? "em_risco" : "no_prazo";
      return status === filter;
    });
  }, [items, filter, finalKey]);
}

/** Conta itens por status (usado nos chips). */
export function useImplStatusCounts(stages: Stage[]) {
  const { items, finalKey } = useDashboardData(stages);
  return useMemo(() => {
    const active = items.filter((i) => i.etapa !== finalKey);
    let no_prazo = 0, em_risco = 0, atrasadas = 0;
    active.forEach((i) => {
      const stale = daysBetween(i.updated_at) ?? 0;
      const total = daysBetween(i.created_at) ?? 0;
      if (total > 21 || stale > 21) atrasadas++;
      else if (stale > 14) em_risco++;
      else no_prazo++;
    });
    return { todas: items.length, no_prazo, em_risco, atrasadas };
  }, [items, finalKey]);
}
