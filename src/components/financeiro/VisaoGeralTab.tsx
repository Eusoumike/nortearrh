import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const COLOR_TOTAL = "#0F7173";
const COLOR_VR = "#1D9E75";
const COLOR_PONTO = "#185FA5";

type LancVR = {
  client_id: string | null;
  cliente_nome: string;
  competencia: string;
  valor_comissao: number;
  fidelidade_vencimento: string | null;
};

type LancPonto = {
  client_id: string | null;
  cliente_nome: string;
  competencia: string;
  valor_nortear: number;
  fidelidade_vencimento: string | null;
};

const ymdFirst = (d: Date) => format(startOfMonth(d), "yyyy-MM-dd");
const ymdLast = (d: Date) => format(endOfMonth(d), "yyyy-MM-dd");

export function VisaoGeralTab() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const rangeStart = useMemo(() => startOfMonth(subMonths(month, 11)), [month]);
  const rangeEnd = useMemo(() => endOfMonth(month), [month]);

  // Janela: últimos 12 meses (inclui o mês selecionado e o anterior para variação)
  const queryStart = useMemo(() => ymdFirst(subMonths(month, 12)), [month]);
  const queryEnd = useMemo(() => ymdLast(month), [month]);

  const vrQuery = useQuery({
    queryKey: ["financeiro-vr", queryStart, queryEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_vr")
        .select("client_id, cliente_nome, competencia, valor_comissao, fidelidade_vencimento")
        .gte("competencia", queryStart)
        .lte("competencia", queryEnd);
      if (error) throw error;
      return (data ?? []) as LancVR[];
    },
  });

  const pontoQuery = useQuery({
    queryKey: ["financeiro-ponto", queryStart, queryEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select("client_id, cliente_nome, competencia, valor_nortear")
        .gte("competencia", queryStart)
        .lte("competencia", queryEnd);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        client_id: r.client_id,
        cliente_nome: r.cliente_nome,
        competencia: r.competencia,
        valor_nortear: Number(r.valor_nortear),
        fidelidade_vencimento: null,
      })) as LancPonto[];
    },
  });

  // Alertas de fidelidade (vencidos OU vence em <= 30d)
  const alertsQuery = useQuery({
    queryKey: ["financeiro-fidelidade-alertas"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const limit = format(addMonths(new Date(), 1), "yyyy-MM-dd");
      const [vr, ponto] = await Promise.all([
        supabase
          .from("lancamentos_vr")
          .select("id, cliente_nome, fidelidade_vencimento")
          .not("fidelidade_vencimento", "is", null)
          .lte("fidelidade_vencimento", limit),
        supabase
          .from("lancamentos_ponto")
          .select("id, cliente_nome, fidelidade_vencimento")
          .not("fidelidade_vencimento", "is", null)
          .lte("fidelidade_vencimento", limit),
      ]);
      if (vr.error) throw vr.error;
      if (ponto.error) throw ponto.error;
      const items = [
        ...(vr.data ?? []).map((r: any) => ({
          id: `vr-${r.id}`,
          tipo: "VR" as const,
          cliente: r.cliente_nome as string,
          venc: r.fidelidade_vencimento as string,
        })),
        ...(ponto.data ?? []).map((r: any) => ({
          id: `ponto-${r.id}`,
          tipo: "Ponto" as const,
          cliente: r.cliente_nome as string,
          venc: r.fidelidade_vencimento as string,
        })),
      ];
      void today;
      return items.sort((a, b) => a.venc.localeCompare(b.venc));
    },
  });

  const loading = vrQuery.isLoading || pontoQuery.isLoading;

  // Agregação por mês (chave yyyy-MM)
  const byMonth = useMemo(() => {
    const map = new Map<
      string,
      { vr: number; ponto: number; vrClients: Set<string>; pontoClients: Set<string> }
    >();
    const ensure = (key: string) => {
      let entry = map.get(key);
      if (!entry) {
        entry = { vr: 0, ponto: 0, vrClients: new Set(), pontoClients: new Set() };
        map.set(key, entry);
      }
      return entry;
    };
    for (const r of vrQuery.data ?? []) {
      const key = r.competencia.slice(0, 7);
      const e = ensure(key);
      e.vr += Number(r.valor_comissao || 0);
      e.vrClients.add(r.client_id ?? r.cliente_nome);
    }
    for (const r of pontoQuery.data ?? []) {
      const key = r.competencia.slice(0, 7);
      const e = ensure(key);
      e.ponto += Number(r.valor_nortear || 0);
      e.pontoClients.add(r.client_id ?? r.cliente_nome);
    }
    return map;
  }, [vrQuery.data, pontoQuery.data]);

  const monthKey = format(month, "yyyy-MM");
  const prevKey = format(subMonths(month, 1), "yyyy-MM");
  const current = byMonth.get(monthKey);
  const previous = byMonth.get(prevKey);

  const mrrVR = current?.vr ?? 0;
  const mrrPonto = current?.ponto ?? 0;
  const mrrTotal = mrrVR + mrrPonto;
  const prevTotal = (previous?.vr ?? 0) + (previous?.ponto ?? 0);
  const diff = mrrTotal - prevTotal;
  const diffPct = prevTotal > 0 ? (diff / prevTotal) * 100 : mrrTotal > 0 ? 100 : 0;
  const hasAnyMonth = mrrTotal > 0;

  // Série gráfico — últimos 12 meses (inclui o mês selecionado)
  const chartData = useMemo(() => {
    const out: { mes: string; total: number; vr: number; ponto: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(month, i);
      const key = format(d, "yyyy-MM");
      const e = byMonth.get(key);
      const vr = e?.vr ?? 0;
      const ponto = e?.ponto ?? 0;
      out.push({
        mes: format(d, "LLL", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
        total: vr + ponto,
        vr,
        ponto,
      });
    }
    return out;
  }, [byMonth, month]);

  // Top 5 do mês
  const top5 = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nome: string; vr: number; ponto: number; total: number }
    >();
    const ensure = (id: string | null, nome: string) => {
      const key = id ?? `nome:${nome}`;
      let row = map.get(key);
      if (!row) {
        row = { id: id ?? "", nome, vr: 0, ponto: 0, total: 0 };
        map.set(key, row);
      }
      return row;
    };
    for (const r of vrQuery.data ?? []) {
      if (r.competencia.slice(0, 7) !== monthKey) continue;
      const row = ensure(r.client_id, r.cliente_nome);
      row.vr += Number(r.valor_comissao || 0);
      row.total = row.vr + row.ponto;
    }
    for (const r of pontoQuery.data ?? []) {
      if (r.competencia.slice(0, 7) !== monthKey) continue;
      const row = ensure(r.client_id, r.cliente_nome);
      row.ponto += Number(r.valor_nortear || 0);
      row.total = row.vr + row.ponto;
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [vrQuery.data, pontoQuery.data, monthKey]);

  // Alertas processados
  const alerts = useMemo(() => {
    const today = startOfMonth(new Date()); // base do dia para diferença em dias
    const now = new Date();
    return (alertsQuery.data ?? [])
      .map((a) => {
        const d = new Date(a.venc + "T00:00:00");
        const days = differenceInCalendarDays(d, now);
        return { ...a, days, vencido: days < 0 };
      })
      .filter((a) => a.vencido || a.days <= 30)
      .slice(0, 8);
    void today;
  }, [alertsQuery.data]);

  const monthLabel = format(month, "LLLL / yyyy", { locale: ptBR }).replace(
    /^./,
    (c) => c.toUpperCase(),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Seletor de mês */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => setMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center text-base font-semibold capitalize">
            {monthLabel}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonth(startOfMonth(new Date()))}
          disabled={format(month, "yyyy-MM") === format(new Date(), "yyyy-MM")}
        >
          Hoje
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="MRR Total"
          value={BRL.format(mrrTotal)}
          hint={hasAnyMonth ? "Receita recorrente do mês" : "Nenhum lançamento"}
        />
        <KpiCard
          label="VR Benefícios"
          value={BRL.format(mrrVR)}
          hint={
            current && current.vrClients.size > 0
              ? `${current.vrClients.size} cliente${current.vrClients.size === 1 ? "" : "s"}`
              : "Nenhum lançamento"
          }
          accent={COLOR_VR}
        />
        <KpiCard
          label="RH Digital"
          value={BRL.format(mrrPonto)}
          hint={
            current && current.pontoClients.size > 0
              ? `${current.pontoClients.size} cliente${current.pontoClients.size === 1 ? "" : "s"}`
              : "Nenhum lançamento"
          }
          accent={COLOR_PONTO}
        />
        <VariationCard diff={diff} diffPct={diffPct} hasPrev={prevTotal > 0} />
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((a) => (
            <Card
              key={a.id}
              className={cn(
                "flex items-start gap-3 border-l-4 p-4",
                a.vencido
                  ? "border-l-destructive bg-destructive/5"
                  : "border-l-amber-500 bg-amber-500/5",
              )}
            >
              {a.vencido ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              ) : (
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div className="text-sm leading-snug">
                <div className="font-medium">{a.cliente}</div>
                <div className="text-muted-foreground">
                  Fidelidade {a.tipo}{" "}
                  {a.vencido
                    ? `venceu em ${format(new Date(a.venc + "T00:00:00"), "dd/MM/yyyy")}`
                    : `vence em ${a.days} ${a.days === 1 ? "dia" : "dias"}`}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Gráfico */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Receita recorrente</h2>
            <p className="text-xs text-muted-foreground">
              Últimos 12 meses — {format(rangeStart, "MMM/yy", { locale: ptBR })} até{" "}
              {format(rangeEnd, "MMM/yy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="h-72 w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR_TOTAL} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={COLOR_TOTAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="mes"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [BRL.format(value), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="transparent"
                  fill="url(#totalGradient)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke={COLOR_TOTAL}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="vr"
                  name="VR Benefícios"
                  stroke={COLOR_VR}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ponto"
                  name="RH Digital"
                  stroke={COLOR_PONTO}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Top 5 */}
      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Top 5 clientes — {monthLabel}</h2>
        {top5.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum lançamento registrado neste mês.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">VR Benefícios</TableHead>
                <TableHead className="text-right">RH Digital</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top5.map((row) => (
                <TableRow key={row.id || row.nome}>
                  <TableCell className="font-medium">
                    {row.id ? (
                      <Link
                        to={`/clientes/${row.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.nome}
                      </Link>
                    ) : (
                      row.nome
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {BRL.format(row.vr)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {BRL.format(row.ponto)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {BRL.format(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      {accent && (
        <span
          className="absolute left-0 top-0 h-full w-1"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
      )}
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function VariationCard({
  diff,
  diffPct,
  hasPrev,
}: {
  diff: number;
  diffPct: number;
  hasPrev: boolean;
}) {
  const isZero = diff === 0;
  const positive = diff > 0;
  const Icon = isZero ? Minus : positive ? ArrowUp : ArrowDown;
  const color = isZero
    ? "text-muted-foreground"
    : positive
      ? "text-emerald-500"
      : "text-destructive";
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Variação vs mês anterior
      </div>
      <div className={cn("mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums", color)}>
        <Icon className="h-5 w-5" />
        {BRL.format(Math.abs(diff))}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {hasPrev ? `${positive ? "+" : ""}${diffPct.toFixed(1)}% vs mês anterior` : "Sem dados do mês anterior"}
      </div>
    </Card>
  );
}
