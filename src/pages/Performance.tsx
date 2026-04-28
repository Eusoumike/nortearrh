import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ToneBadge } from "@/components/ui/tone-badge";
import { BarChart3, Clock, Trophy, Target, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { TIMED_STAGES, SLA_PER_STAGE_HOURS, STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { formatDuration } from "@/lib/formatters";

const PERIOD_DAYS = 30;

export default function Performance() {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIOD_DAYS);
    return d.toISOString();
  }, []);

  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ["perf-tickets", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, status, priority, opened_at, resolved_at, assigned_to, assigned_name, sla_resolution_deadline, total_em_atendimento_seconds, total_aguardando_cliente_seconds, total_vera_n1_seconds, total_n2_seconds")
        .gte("opened_at", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stageData = useMemo(() => {
    if (!tickets) return [];
    return TIMED_STAGES.map((s) => {
      const col = s.totalCol as keyof (typeof tickets)[number];
      const values = tickets.map((t: any) => Number(t[col] ?? 0)).filter((v) => v > 0);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const slaSec = SLA_PER_STAGE_HOURS[s.key] * 3600;
      return {
        name: s.label,
        avgSeconds: Math.round(avg),
        avgHours: +(avg / 3600).toFixed(1),
        slaHours: SLA_PER_STAGE_HOURS[s.key],
        overSla: avg > slaSec,
      };
    });
  }, [tickets]);

  const ranking = useMemo(() => {
    if (!tickets) return [];
    const map = new Map<string, { name: string; resolved: number; total: number }>();
    tickets.forEach((t: any) => {
      const key = t.assigned_to ?? "_unassigned";
      const name = t.assigned_name ?? "Sem responsável";
      if (!map.has(key)) map.set(key, { name, resolved: 0, total: 0 });
      const e = map.get(key)!;
      e.total += 1;
      if (t.resolved_at) e.resolved += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 8);
  }, [tickets]);

  const slaStats = useMemo(() => {
    if (!tickets) return { total: 0, withDeadline: 0, met: 0, missed: 0, percent: 0 };
    const withDeadline = tickets.filter((t: any) => t.sla_resolution_deadline);
    let met = 0, missed = 0;
    withDeadline.forEach((t: any) => {
      if (!t.resolved_at) {
        if (new Date(t.sla_resolution_deadline) < new Date()) missed += 1;
        return;
      }
      if (new Date(t.resolved_at) <= new Date(t.sla_resolution_deadline)) met += 1;
      else missed += 1;
    });
    const considered = met + missed;
    return {
      total: tickets.length,
      withDeadline: withDeadline.length,
      met,
      missed,
      percent: considered ? Math.round((met / considered) * 100) : 0,
    };
  }, [tickets]);

  const statusDist = useMemo(() => {
    if (!tickets) return [];
    const map: Record<string, number> = {};
    tickets.forEach((t: any) => { map[t.status] = (map[t.status] ?? 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({
      name: STATUS_LABEL[k as TicketStatus] ?? k,
      value: v,
    }));
  }, [tickets]);

  if (loadingTickets) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando métricas…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="font-display text-3xl font-normal tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground">Métricas dos últimos {PERIOD_DAYS} dias.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Chamados abertos" value={String(slaStats.total)} />
        <Kpi
          icon={<Target className="h-4 w-4" />}
          label="SLA cumprido"
          value={`${slaStats.percent}%`}
          tone={slaStats.percent >= 80 ? "success" : slaStats.percent >= 60 ? "warning" : "danger"}
          hint={`${slaStats.met} ok · ${slaStats.missed} estourados`}
        />
        <Kpi
          icon={<Clock className="h-4 w-4" />}
          label="Etapas em SLA"
          value={`${stageData.filter((s) => !s.overSla).length}/${stageData.length}`}
          hint="Tempo médio dentro do SLA"
        />
        <Kpi
          icon={<Trophy className="h-4 w-4" />}
          label="Top agente"
          value={ranking[0]?.name?.split(" ")[0] ?? "—"}
          hint={ranking[0] ? `${ranking[0].resolved} resolvidos` : ""}
        />
      </div>

      {/* Tempo médio por etapa */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tempo médio por etapa (horas)</h3>
          <span className="text-[11px] text-muted-foreground">Linha vermelha = SLA estourado</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={stageData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: any, _n, p: any) => [
                  `${v}h (SLA ${p.payload.slaHours}h)`,
                  "Tempo médio",
                ]}
              />
              <Bar dataKey="avgHours" radius={[4, 4, 0, 0]}>
                {stageData.map((s, i) => (
                  <Cell key={i} fill={s.overSla ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {stageData.map((s) => (
            <div key={s.name} className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.name}</p>
              <p className={`text-sm font-semibold ${s.overSla ? "text-destructive" : "text-foreground"}`}>
                {s.avgSeconds > 0 ? formatDuration(s.avgSeconds) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">SLA: {s.slaHours}h</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Ranking de agentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">Ranking de agentes (resolvidos)</h3>
          <div className="space-y-2">
            {ranking.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Sem dados no período.</p>
            )}
            {ranking.map((r, i) => {
              const rate = r.total ? Math.round((r.resolved / r.total) * 100) : 0;
              return (
                <div key={r.name + i} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.resolved} de {r.total} chamados · {rate}% taxa</p>
                  </div>
                  <ToneBadge tone={rate >= 80 ? "success" : rate >= 50 ? "warning" : "danger"} size="sm">
                    {rate}%
                  </ToneBadge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">Distribuição por status</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={statusDist} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon, label, value, hint, tone,
}: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "success" | "warning" | "danger" }) {
  const toneClass =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
