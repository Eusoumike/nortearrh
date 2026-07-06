import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, PieChart as PieIcon, Activity } from "lucide-react";
import {
  MODULO_AFETADO_COLORS,
  MODULO_AFETADO_LABEL,
  ORIGEM_PROBLEMA_LABEL,
} from "@/lib/constants";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";

const ORIGEM_COLORS = [
  "#3B82F6", "#F59E0B", "#EF4444", "#10B981",
  "#8B5CF6", "#EC4899", "#14B8A6",
];

export function InsightsChamados() {
  const { data: last14, isLoading } = useQuery({
    queryKey: ["dashboard-insights-tickets"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("tickets")
        .select("modulo_afetado, origem_problema, tema, created_at")
        .gte("created_at", cutoff)
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: last30, isLoading: loading30 } = useQuery({
    queryKey: ["dashboard-insights-origem-30d"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("tickets")
        .select("origem_problema")
        .gte("created_at", cutoff)
        .not("origem_problema", "is", null)
        .limit(3000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const now = Date.now();
  const boundary7 = now - 7 * 86400000;

  const porModulo = useMemo(() => {
    const map = new Map<string, number>();
    (last14 ?? []).forEach((t: any) => {
      if (!t.modulo_afetado) return;
      const dt = new Date(t.created_at).getTime();
      if (dt < boundary7) return;
      map.set(t.modulo_afetado, (map.get(t.modulo_afetado) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([k, v]) => ({ key: k, label: MODULO_AFETADO_LABEL[k] ?? k, total: v, color: MODULO_AFETADO_COLORS[k] ?? "#6B7280" }))
      .sort((a, b) => b.total - a.total);
  }, [last14, boundary7]);

  const porOrigem = useMemo(() => {
    const map = new Map<string, number>();
    (last30 ?? []).forEach((t: any) => {
      if (!t.origem_problema) return;
      map.set(t.origem_problema, (map.get(t.origem_problema) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([k, v], i) => ({ key: k, name: ORIGEM_PROBLEMA_LABEL[k] ?? k, value: v, color: ORIGEM_COLORS[i % ORIGEM_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [last30]);

  const temasEmAlta = useMemo(() => {
    const atual = new Map<string, number>();
    const anterior = new Map<string, number>();
    (last14 ?? []).forEach((t: any) => {
      if (!t.tema) return;
      const dt = new Date(t.created_at).getTime();
      if (dt >= boundary7) atual.set(t.tema, (atual.get(t.tema) ?? 0) + 1);
      else anterior.set(t.tema, (anterior.get(t.tema) ?? 0) + 1);
    });
    const rows: { tema: string; atual: number; anterior: number; delta: number }[] = [];
    atual.forEach((v, k) => {
      const ant = anterior.get(k) ?? 0;
      if (v - ant > 0) rows.push({ tema: k, atual: v, anterior: ant, delta: v - ant });
    });
    return rows.sort((a, b) => b.delta - a.delta).slice(0, 5);
  }, [last14, boundary7]);

  const maxModulo = Math.max(1, ...porModulo.map((r) => r.total));
  const totalOrigem = porOrigem.reduce((s, r) => s + r.value, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold tracking-tight">Insights de Chamados</h2>
        <span className="text-[11px] text-muted-foreground">novos campos de tratativa</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chamados por módulo (7d) */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Chamados por módulo</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">últimos 7 dias</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : porModulo.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sem dados no período</p>
          ) : (
            <ul className="space-y-2">
              {porModulo.slice(0, 8).map((r) => (
                <li key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{r.label}</span>
                    <span className="font-mono text-muted-foreground">{r.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(r.total / maxModulo) * 100}%`, backgroundColor: r.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Origem do problema (30d) */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Origem dos problemas</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">últimos 30 dias</span>
          </div>
          {loading30 ? (
            <Skeleton className="h-40" />
          ) : porOrigem.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sem dados no período</p>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porOrigem}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={68}
                      paddingAngle={2}
                    >
                      {porOrigem.map((e) => <Cell key={e.key} fill={e.color} />)}
                    </Pie>
                    <RTooltip formatter={(v: any) => `${v} chamado${v === 1 ? "" : "s"}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-1.5 text-xs">
                {porOrigem.map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="font-mono text-muted-foreground">
                      {Math.round((r.value / totalOrigem) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Temas em alta */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Temas em alta</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">7d vs anteriores</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : temasEmAlta.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Nenhum tema com crescimento</p>
          ) : (
            <ol className="space-y-2.5">
              {temasEmAlta.map((r, i) => (
                <li key={r.tema} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{r.tema}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.atual} agora · {r.anterior} antes
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-success">
                    +{r.delta}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </section>
  );
}
