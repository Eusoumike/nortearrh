import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ToneBadge } from "@/components/ui/tone-badge";
import { BarChart3, Clock, Trophy, Target, Loader2, FileText, Copy, Star, ArrowRight, TrendingUp, Flame, Timer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  ComposedChart, Line, LineChart, Area, AreaChart,
} from "recharts";
import { TIMED_STAGES, SLA_PER_STAGE_HOURS, STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { formatDuration } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
  { value: "365", label: "Último ano" },
  { value: "all", label: "Todos" },
];

export default function Performance() {
  const [periodDays, setPeriodDays] = useState<string>("30");
  const [topPeriodDays, setTopPeriodDays] = useState<string>("30");
  const [materialFor, setMaterialFor] = useState<{ title: string; count: number } | null>(null);
  const [materialText, setMaterialText] = useState("");

  const since = useMemo(() => {
    if (periodDays === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(periodDays));
    return d.toISOString();
  }, [periodDays]);

  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ["perf-tickets", since],
    queryFn: async () => {
      let q = supabase
        .from("tickets")
        .select("id, status, priority, opened_at, resolved_at, assigned_to, assigned_name, sla_resolution_deadline, total_em_atendimento_seconds, total_aguardando_cliente_seconds, total_vera_n1_seconds, total_n2_seconds");
      if (since) q = q.gte("opened_at", since);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // === Top problemas recorrentes ===
  const topSince = useMemo(() => {
    if (topPeriodDays === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(topPeriodDays));
    return d.toISOString();
  }, [topPeriodDays]);

  const { data: topRows, isLoading: loadingTop } = useQuery({
    queryKey: ["perf-top-titles", topSince],
    queryFn: async () => {
      let q = supabase
        .from("tickets")
        .select("id, title, opened_at, resolved_at");
      if (topSince) q = q.gte("opened_at", topSince);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const topProblems = useMemo(() => {
    if (!topRows) return [];
    const map = new Map<string, { title: string; count: number; resolvedSec: number[]; }>();
    topRows.forEach((t: any) => {
      const titleKey = (t.title || "Sem título").trim();
      if (!map.has(titleKey)) map.set(titleKey, { title: titleKey, count: 0, resolvedSec: [] });
      const e = map.get(titleKey)!;
      e.count += 1;
      if (t.resolved_at && t.opened_at) {
        const sec = Math.max(0, (new Date(t.resolved_at).getTime() - new Date(t.opened_at).getTime()) / 1000);
        e.resolvedSec.push(sec);
      }
    });
    const total = topRows.length || 1;
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((r) => ({
        title: r.title,
        count: r.count,
        pct: Math.round((r.count / total) * 100),
        avgResolution: r.resolvedSec.length
          ? r.resolvedSec.reduce((a, b) => a + b, 0) / r.resolvedSec.length
          : 0,
      }));
  }, [topRows]);

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

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === periodDays)?.label ?? "";

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-foreground">{periodLabel}.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Período:</span>
          <Select value={periodDays} onValueChange={setPeriodDays}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="pareto">Pareto</TabsTrigger>
          <TabsTrigger value="heatmap">Mapa de calor</TabsTrigger>
          <TabsTrigger value="frt">Tempo de resposta</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="pareto" className="space-y-4">
          <ParetoTab
            onMaterial={(title, count) => {
              setMaterialFor({ title, count });
              setMaterialText("");
            }}
          />
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-4">
          <HeatmapTab />
        </TabsContent>

        <TabsContent value="frt" className="space-y-4">
          <FrtTab />
        </TabsContent>
      </Tabs>

      {/* Material de apoio */}
      <Dialog open={!!materialFor} onOpenChange={(o) => !o && setMaterialFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Material de apoio — {materialFor?.title}</DialogTitle>
            <DialogDescription>
              Anote o conteúdo do material de apoio que será criado para este problema recorrente
              ({materialFor?.count} ocorrências). Você pode copiar o texto ao final.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={materialText}
            onChange={(e) => setMaterialText(e.target.value)}
            placeholder={`Estrutura sugerida:

• Sintoma observado
• Causa provável
• Passo a passo da solução
• Como prevenir / orientação ao cliente
• Links / vídeos / capturas de tela`}
            rows={14}
            className="font-mono text-[13px]"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!materialText.trim()) return;
                try {
                  await navigator.clipboard.writeText(
                    `# Material de apoio — ${materialFor?.title}\n\n${materialText.trim()}\n`,
                  );
                  toast({ title: "Texto copiado" });
                } catch {
                  toast({ title: "Erro ao copiar", variant: "destructive" });
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar texto
            </Button>
            <Button onClick={() => setMaterialFor(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

// =====================================================
// Constantes para os novos relatórios
// =====================================================

const PARETO_PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

const HEATMAP_PERIOD_OPTIONS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

const FRT_PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_LABELS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const TEAL = "#0F7173";
const AMBER = "#F59E0B";

function sinceFromDays(days: string): string | null {
  if (days === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - Number(days));
  return d.toISOString();
}

function formatFrt(minutes: number): string {
  if (!isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = minutes / 60;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
      {message ?? "Dados insuficientes — aguardando mais chamados para gerar este relatório."}
    </div>
  );
}

// =====================================================
// ABA 1 — PARETO
// =====================================================

function ParetoTab({ onMaterial }: { onMaterial: (title: string, count: number) => void }) {
  const [period, setPeriod] = useState("30");
  const since = useMemo(() => sinceFromDays(period), [period]);

  const { data, isLoading } = useQuery({
    queryKey: ["pareto-tickets", since],
    queryFn: async () => {
      let q = supabase.from("tickets").select("id, title, opened_at");
      if (since) q = q.gte("opened_at", since);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const analysis = useMemo(() => {
    const rows = data ?? [];
    const total = rows.length;
    const map = new Map<string, number>();
    rows.forEach((t: any) => {
      const k = (t.title || "Sem título").trim();
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    const all = Array.from(map.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);

    const top10 = all.slice(0, 10);
    let cum = 0;
    const enriched = top10.map((r, i) => {
      cum += r.count;
      return {
        rank: i + 1,
        title: r.title,
        titleShort: r.title.length > 30 ? r.title.slice(0, 30) + "…" : r.title,
        count: r.count,
        pct: total > 0 ? (r.count / total) * 100 : 0,
        cumPct: total > 0 ? (cum / total) * 100 : 0,
      };
    });

    const top3Count = all.slice(0, 3).reduce((s, r) => s + r.count, 0);
    const top3Pct = total > 0 ? Math.round((top3Count / total) * 100) : 0;

    return {
      total,
      uniqueTitles: all.length,
      top3Pct,
      rows: enriched,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando Pareto…
      </div>
    );
  }

  if (analysis.total < 10) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARETO_PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Princípio de Pareto: identifique os poucos problemas que causam a maioria dos chamados.</p>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARETO_PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Kpi icon={<FileText className="h-4 w-4" />} label="Títulos diferentes" value={String(analysis.uniqueTitles)} hint="Diversidade de problemas" />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Top 3 representam" value={`${analysis.top3Pct}%`} hint="Concentração dos problemas" tone={analysis.top3Pct >= 50 ? "warning" : undefined} />
        <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Total analisado" value={String(analysis.total)} hint="Chamados no período" />
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold">Top 10 problemas com curva de Pareto</h3>
        <div className="h-96">
          <ResponsiveContainer>
            <ComposedChart
              data={analysis.rows}
              layout="vertical"
              margin={{ top: 8, right: 48, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <XAxis xAxisId="pct" type="number" orientation="top" domain={[0, 100]} tick={{ fontSize: 10, fill: AMBER }} unit="%" />
              <YAxis
                type="category"
                dataKey="titleShort"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                width={200}
                interval={0}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                formatter={(v: any, n: any) => {
                  if (n === "count") return [`${v} chamados`, "Quantidade"];
                  if (n === "cumPct") return [`${Number(v).toFixed(1)}%`, "Acumulado"];
                  return [v, n];
                }}
                labelFormatter={(_l, payload: any) => payload?.[0]?.payload?.title ?? ""}
              />
              <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} />
              <Line xAxisId="pct" type="monotone" dataKey="cumPct" stroke={AMBER} strokeWidth={2} dot={{ r: 3, fill: AMBER }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold">Detalhamento</h3>
        <p className="text-[11px] text-muted-foreground">Linhas destacadas representam os problemas que somam até 80% do volume (foco prioritário).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Título</th>
                <th className="py-2 pr-3 text-right font-medium">Quantidade</th>
                <th className="py-2 pr-3 text-right font-medium">% do total</th>
                <th className="py-2 pr-3 text-right font-medium">% acumulado</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((r) => {
                const isPareto = r.cumPct <= 80;
                return (
                  <tr
                    key={r.title}
                    className={`border-b last:border-0 ${isPareto ? "bg-warning/10" : ""}`}
                  >
                    <td className="py-2 pr-3 text-muted-foreground">{r.rank}</td>
                    <td className="py-2 pr-3 font-medium">{r.title}</td>
                    <td className="py-2 pr-3 text-right font-mono">{r.count}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{r.pct.toFixed(1)}%</td>
                    <td className="py-2 pr-3 text-right font-mono text-amber-600 dark:text-amber-500">{r.cumPct.toFixed(1)}%</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onMaterial(r.title, r.count)}>
                        <FileText className="mr-2 h-3.5 w-3.5" /> Material
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// =====================================================
// ABA 2 — MAPA DE CALOR
// =====================================================

function HeatmapTab() {
  const [period, setPeriod] = useState("30");
  const [showAllHours, setShowAllHours] = useState(false);
  const since = useMemo(() => sinceFromDays(period), [period]);

  const { data, isLoading } = useQuery({
    queryKey: ["heatmap-tickets", since],
    queryFn: async () => {
      let q = supabase.from("tickets").select("id, opened_at, created_at");
      if (since) q = q.gte("opened_at", since);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const analysis = useMemo(() => {
    const rows = data ?? [];
    // grid[hour][day] = count
    const grid: number[][] = Array.from({ length: 24 }, () => Array(7).fill(0));
    rows.forEach((t: any) => {
      const dt = new Date(t.opened_at ?? t.created_at);
      if (isNaN(dt.getTime())) return;
      const day = dt.getDay();
      const hour = dt.getHours();
      grid[hour][day] += 1;
    });

    // pico
    let peak = { hour: -1, day: -1, count: 0 };
    for (let h = 0; h < 24; h++) {
      for (let d = 0; d < 7; d++) {
        if (grid[h][d] > peak.count) peak = { hour: h, day: d, count: grid[h][d] };
      }
    }

    // dia mais movimentado
    const byDay = Array(7).fill(0);
    grid.forEach((row) => row.forEach((v, d) => (byDay[d] += v)));
    let busiestDay = 0;
    byDay.forEach((v, i) => { if (v > byDay[busiestDay]) busiestDay = i; });

    // hora mais calma (só horário comercial 8-18)
    const byHour = Array(24).fill(0);
    grid.forEach((row, h) => row.forEach((v) => (byHour[h] += v)));
    let calmHour = 8;
    let calmCount = Infinity;
    for (let h = 8; h <= 18; h++) {
      if (byHour[h] < calmCount) { calmCount = byHour[h]; calmHour = h; }
    }

    return { grid, peak, busiestDay, calmHour, total: rows.length };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando mapa de calor…
      </div>
    );
  }

  if (analysis.total < 10) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HEATMAP_PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <EmptyState />
      </div>
    );
  }

  const cellColor = (n: number): string => {
    if (n === 0) return "hsl(var(--muted))";
    if (n <= 2) return "#9FE1CB";
    if (n <= 5) return "#1D9E75";
    return "#085041";
  };

  const cellTextColor = (n: number): string => {
    if (n === 0) return "hsl(var(--muted-foreground))";
    if (n <= 2) return "#0F3D2E";
    return "#FFFFFF";
  };

  const hours = showAllHours
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 14 }, (_, i) => i + 7); // 7..20

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Concentração de chamados abertos por dia da semana e hora.</p>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {HEATMAP_PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Kpi
          icon={<Flame className="h-4 w-4" />}
          label="Pico de demanda"
          value={analysis.peak.count > 0 ? `${DAY_LABELS_FULL[analysis.peak.day]} ${String(analysis.peak.hour).padStart(2, "0")}h` : "—"}
          hint={analysis.peak.count > 0 ? `${analysis.peak.count} chamados` : undefined}
          tone="warning"
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Dia mais movimentado"
          value={DAY_LABELS_FULL[analysis.busiestDay]}
        />
        <Kpi
          icon={<Clock className="h-4 w-4" />}
          label="Horário mais calmo"
          value={`${String(analysis.calmHour).padStart(2, "0")}h`}
          hint="Horário comercial (8h–18h)"
        />
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Mapa de calor — Dia × Hora</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAllHours((v) => !v)}>
            {showAllHours ? "Mostrar 07h–20h" : "Ver horário completo"}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            {/* Cabeçalho dos dias */}
            <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}>
              <div />
              {DAY_LABELS.map((d) => (
                <div key={d} className="px-1 pb-1 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            {/* Linhas (horas) */}
            <div className="space-y-1">
              {hours.map((h) => (
                <div key={h} className="grid items-center gap-1" style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}>
                  <div className="text-right pr-2 text-[10px] font-mono text-muted-foreground">
                    {String(h).padStart(2, "0")}h
                  </div>
                  {DAY_LABELS.map((_, d) => {
                    const n = analysis.grid[h][d];
                    return (
                      <div
                        key={d}
                        className="flex h-8 items-center justify-center rounded text-[11px] font-semibold transition-transform hover:scale-110"
                        style={{ backgroundColor: cellColor(n), color: cellTextColor(n) }}
                        title={`${DAY_LABELS_FULL[d]} ${String(h).padStart(2, "0")}h — ${n} chamado${n === 1 ? "" : "s"}`}
                      >
                        {n > 0 ? n : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-muted-foreground">
          <span>Volume:</span>
          <LegendItem color="hsl(var(--muted))" label="0" />
          <LegendItem color="#9FE1CB" label="1–2" />
          <LegendItem color="#1D9E75" label="3–5" />
          <LegendItem color="#085041" label="6+" />
        </div>
      </Card>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

// =====================================================
// ABA 3 — TEMPO DE RESPOSTA (FRT)
// =====================================================

function FrtTab() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30");
  const since = useMemo(() => sinceFromDays(period), [period]);

  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ["frt-tickets", since],
    queryFn: async () => {
      let q = supabase
        .from("tickets")
        .select("id, ticket_number, title, client_name, organization, opened_at, created_at");
      if (since) q = q.gte("opened_at", since);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ticketIds = useMemo(() => (tickets ?? []).map((t: any) => t.id), [tickets]);

  const { data: interactions, isLoading: loadingInter } = useQuery({
    queryKey: ["frt-interactions", ticketIds.length, ticketIds[0]],
    enabled: ticketIds.length > 0,
    queryFn: async () => {
      // Busca em lotes para evitar URLs muito grandes
      const chunkSize = 200;
      const all: any[] = [];
      for (let i = 0; i < ticketIds.length; i += chunkSize) {
        const chunk = ticketIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("ticket_interactions")
          .select("ticket_id, created_at")
          .in("ticket_id", chunk)
          .order("created_at", { ascending: true });
        if (error) throw error;
        all.push(...(data ?? []));
      }
      return all;
    },
  });

  const analysis = useMemo(() => {
    if (!tickets || !interactions) return null;
    // primeira interação por ticket
    const firstByTicket = new Map<string, string>();
    interactions.forEach((it: any) => {
      if (!firstByTicket.has(it.ticket_id)) firstByTicket.set(it.ticket_id, it.created_at);
    });

    type Row = { id: string; ticket_number: string; title: string; client: string; opened_at: string; frtMin: number };
    const rows: Row[] = [];
    tickets.forEach((t: any) => {
      const first = firstByTicket.get(t.id);
      if (!first) return;
      const opened = new Date(t.opened_at ?? t.created_at).getTime();
      const f = new Date(first).getTime();
      const min = Math.max(0, (f - opened) / 60000);
      rows.push({
        id: t.id,
        ticket_number: t.ticket_number ?? "",
        title: t.title ?? "Sem título",
        client: t.client_name ?? t.organization ?? "—",
        opened_at: t.opened_at ?? t.created_at,
        frtMin: min,
      });
    });

    if (rows.length === 0) {
      return { rows, avg: 0, median: 0, p1h: 0, p4h: 0, weekly: [], buckets: [], slowest: [], totalTickets: tickets.length };
    }

    const minutes = rows.map((r) => r.frtMin).sort((a, b) => a - b);
    const avg = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    const median = minutes[Math.floor(minutes.length / 2)];
    const p1h = (minutes.filter((m) => m < 60).length / minutes.length) * 100;
    const p4h = (minutes.filter((m) => m < 240).length / minutes.length) * 100;

    // Semanal: últimas 8 semanas (segunda a domingo)
    const weeks: { label: string; start: number; end: number; values: number[] }[] = [];
    const now = new Date();
    const day = now.getDay(); // 0=Dom..6=Sab
    const monOffset = (day === 0 ? -6 : 1 - day);
    const thisMon = new Date(now);
    thisMon.setHours(0, 0, 0, 0);
    thisMon.setDate(thisMon.getDate() + monOffset);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisMon);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      weeks.push({
        label: `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`,
        start: start.getTime(),
        end: end.getTime(),
        values: [],
      });
    }
    rows.forEach((r) => {
      const t = new Date(r.opened_at).getTime();
      const w = weeks.find((wk) => t >= wk.start && t < wk.end);
      if (w) w.values.push(r.frtMin);
    });
    const weekly = weeks.map((w) => ({
      week: w.label,
      avgMin: w.values.length ? Math.round(w.values.reduce((a, b) => a + b, 0) / w.values.length) : 0,
      count: w.values.length,
    }));

    // Buckets de distribuição
    const buckets = [
      { range: "< 30min", count: 0, color: "#16A34A" },
      { range: "30min–1h", count: 0, color: "#86EFAC" },
      { range: "1h–4h", count: 0, color: "#F59E0B" },
      { range: "4h–24h", count: 0, color: "#F97316" },
      { range: "> 24h", count: 0, color: "#DC2626" },
    ];
    rows.forEach((r) => {
      if (r.frtMin < 30) buckets[0].count++;
      else if (r.frtMin < 60) buckets[1].count++;
      else if (r.frtMin < 240) buckets[2].count++;
      else if (r.frtMin < 1440) buckets[3].count++;
      else buckets[4].count++;
    });

    const slowest = [...rows].sort((a, b) => b.frtMin - a.frtMin).slice(0, 10);

    return { rows, avg, median, p1h, p4h, weekly, buckets, slowest, totalTickets: tickets.length };
  }, [tickets, interactions]);

  const isLoading = loadingTickets || loadingInter;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando tempo de resposta…
      </div>
    );
  }

  if (!analysis || analysis.totalTickets < 10 || analysis.rows.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FRT_PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">FRT = tempo entre a abertura do chamado e a primeira interação registrada.</p>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FRT_PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<Timer className="h-4 w-4" />} label="FRT médio" value={formatFrt(analysis.avg)} hint={`${analysis.rows.length} chamados respondidos`} />
        <Kpi icon={<Timer className="h-4 w-4" />} label="FRT mediano" value={formatFrt(analysis.median)} hint="Metade dos chamados abaixo" />
        <Kpi
          icon={<Target className="h-4 w-4" />}
          label="Respondidos < 1h"
          value={`${analysis.p1h.toFixed(0)}%`}
          tone={analysis.p1h >= 80 ? "success" : analysis.p1h >= 50 ? "warning" : "danger"}
        />
        <Kpi
          icon={<Target className="h-4 w-4" />}
          label="Respondidos < 4h"
          value={`${analysis.p4h.toFixed(0)}%`}
          tone={analysis.p4h >= 90 ? "success" : analysis.p4h >= 70 ? "warning" : "danger"}
        />
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold">FRT médio por semana — últimas 8 semanas</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={analysis.weekly} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="frtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="m" />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                formatter={(v: any, n: any) => {
                  if (n === "avgMin") return [formatFrt(Number(v)), "FRT médio"];
                  return [v, n];
                }}
              />
              <Area type="monotone" dataKey="avgMin" stroke={TEAL} strokeWidth={2} fill="url(#frtGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold">Distribuição do FRT</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={analysis.buckets} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                formatter={(v: any) => [`${v} chamados`, "Quantidade"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {analysis.buckets.map((b, i) => (
                  <Cell key={i} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold">Top 10 chamados mais lentos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Título</th>
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 text-right font-medium">FRT</th>
                <th className="py-2 pr-3 font-medium">Aberto em</th>
              </tr>
            </thead>
            <tbody>
              {analysis.slowest.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/tickets/${r.id}`)}
                >
                  <td className="py-2 pr-3 font-mono text-muted-foreground">#{r.ticket_number}</td>
                  <td className="py-2 pr-3 font-medium">{r.title}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.client}</td>
                  <td className="py-2 pr-3 text-right font-mono text-destructive">{formatFrt(r.frtMin)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {new Date(r.opened_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
