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
import { BarChart3, Clock, Trophy, Target, Loader2, FileText, Copy } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
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

      {/* Top problemas recorrentes */}
      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Top problemas recorrentes</h3>
            <p className="text-[11px] text-muted-foreground">Títulos de chamado mais repetidos.</p>
          </div>
          <Select value={topPeriodDays} onValueChange={setTopPeriodDays}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loadingTop ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando…
          </div>
        ) : topProblems.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Título</th>
                  <th className="py-2 pr-3 text-right font-medium">Qtd</th>
                  <th className="py-2 pr-3 text-right font-medium">% do total</th>
                  <th className="py-2 pr-3 text-right font-medium">Tempo médio</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {topProblems.map((p, i) => (
                  <tr key={p.title} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium">{p.title}</td>
                    <td className="py-2 pr-3 text-right">{p.count}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{p.pct}%</td>
                    <td className="py-2 pr-3 text-right">
                      {p.avgResolution > 0 ? formatDuration(Math.round(p.avgResolution)) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMaterialFor({ title: p.title, count: p.count });
                          setMaterialText("");
                        }}
                      >
                        <FileText className="mr-2 h-3.5 w-3.5" />
                        Gerar material
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
