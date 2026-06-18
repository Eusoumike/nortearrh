import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
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
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BRL, formatBRDate } from "./financeiroUtils";

const ymdFirst = (d: Date) => format(startOfMonth(d), "yyyy-MM-dd");
const ymdLast = (d: Date) => format(endOfMonth(d), "yyyy-MM-dd");

export function VisaoGeralTab() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  // ============ Janela 6 meses para fluxo de caixa ============
  const fluxoStart = useMemo(() => ymdFirst(subMonths(month, 5)), [month]);
  const fluxoEnd = useMemo(() => ymdLast(month), [month]);

  // ============ Mês atual ============
  const mesStart = useMemo(() => ymdFirst(month), [month]);
  const mesEnd = useMemo(() => ymdLast(month), [month]);
  const monthKey = format(month, "yyyy-MM");

  // ============ KPI: Receita Recorrente (contratos ativos + VR mês atual) ============
  const contratosAtivosQ = useQuery({
    queryKey: ["fin-overview-contratos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_rh_digital")
        .select("valor_mensalidade, valor_nortear, ativo, created_at")
        .eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const vrMesQ = useQuery({
    queryKey: ["fin-overview-vr-mes", mesStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_vr")
        .select("valor_comissao, valor_base, competencia, cliente_nome, client_id")
        .gte("competencia", mesStart)
        .lte("competencia", mesEnd);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rhMesQ = useQuery({
    queryKey: ["fin-overview-rh-mes", mesStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select("valor_mensalidade, valor_nortear, valor_recebido, valor_nortear_recebido, status, competencia, cliente_nome, client_id, contrato_id")
        .gte("competencia", mesStart)
        .lte("competencia", mesEnd);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ============ Histórico 6 meses (fluxo de caixa) ============
  const historicoQ = useQuery({
    queryKey: ["fin-overview-historico", fluxoStart, fluxoEnd],
    queryFn: async () => {
      const [vr, rh] = await Promise.all([
        supabase
          .from("lancamentos_vr")
          .select("valor_comissao, valor_base, competencia")
          .gte("competencia", fluxoStart)
          .lte("competencia", fluxoEnd),
        supabase
          .from("parcelas_rh_digital")
          .select("valor_recebido, valor_mensalidade, competencia, status")
          .gte("competencia", fluxoStart)
          .lte("competencia", fluxoEnd),
      ]);
      if (vr.error) throw vr.error;
      if (rh.error) throw rh.error;
      return { vr: vr.data ?? [], rh: rh.data ?? [] };
    },
  });

  // ============ Saúde dos pagamentos (60 dias) ============
  const saudeStart = useMemo(() => format(subMonths(new Date(), 2), "yyyy-MM-dd"), []);
  const saudeQ = useQuery({
    queryKey: ["fin-overview-saude", saudeStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select("status, valor_recebido, valor_mensalidade, competencia")
        .gte("competencia", saudeStart);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ============ Repasses pendentes (parceiros + KPI comissões) ============
  const repassesPendQ = useQuery({
    queryKey: ["fin-overview-repasses-pend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repasses_parceiro")
        .select("id, parceiro_nome, cliente_nome, produto, valor_repasse, competencia, status")
        .eq("status", "pendente")
        .order("competencia", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ============ Últimos lançamentos (VR + RH unificados) ============
  const ultimosQ = useQuery({
    queryKey: ["fin-overview-ultimos"],
    queryFn: async () => {
      const [vr, rh] = await Promise.all([
        supabase
          .from("lancamentos_vr")
          .select("id, cliente_nome, valor_comissao, valor_base, competencia")
          .order("competencia", { ascending: false })
          .limit(8),
        supabase
          .from("parcelas_rh_digital")
          .select("id, cliente_nome, valor_mensalidade, valor_recebido, competencia, status")
          .order("competencia", { ascending: false })
          .limit(8),
      ]);
      if (vr.error) throw vr.error;
      if (rh.error) throw rh.error;
      return { vr: vr.data ?? [], rh: rh.data ?? [] };
    },
  });

  // ============ Alertas de fidelidade ============
  const alertsQuery = useQuery({
    queryKey: ["fin-overview-fidelidade"],
    queryFn: async () => {
      const limit = format(addMonths(new Date(), 1), "yyyy-MM-dd");
      const [vr, ponto] = await Promise.all([
        supabase
          .from("lancamentos_vr")
          .select("id, cliente_nome, fidelidade_vencimento")
          .not("fidelidade_vencimento", "is", null)
          .lte("fidelidade_vencimento", limit),
        supabase
          .from("contratos_rh_digital")
          .select("id, cliente_nome, fidelidade_vencimento")
          .eq("ativo", true)
          .not("fidelidade_vencimento", "is", null)
          .lte("fidelidade_vencimento", limit),
      ]);
      if (vr.error) throw vr.error;
      if (ponto.error) throw ponto.error;
      return [
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
      ].sort((a, b) => a.venc.localeCompare(b.venc));
    },
  });

  // ============ Derivados ============
  const kpis = useMemo(() => {
    const contratos = contratosAtivosQ.data ?? [];
    const vrMes = vrMesQ.data ?? [];
    const rhMes = rhMesQ.data ?? [];

    // Receita recorrente: comissão Nortear esperada de contratos ativos + soma da comissão VR do mês
    const recorrenciaContratos = contratos.reduce(
      (s, c: any) => s + Number(c.valor_nortear ?? 0),
      0,
    );
    const recorrenciaVR = vrMes.reduce((s, v: any) => s + Number(v.valor_comissao ?? 0), 0);
    const recorrencia = recorrenciaContratos + recorrenciaVR;

    // Previsto no mês: somatório de tudo que tem competência neste mês
    const previstoRH = rhMes.reduce((s, p: any) => s + Number(p.valor_mensalidade ?? 0), 0);
    const previstoVR = vrMes.reduce((s, v: any) => s + Number(v.valor_base ?? v.valor_comissao ?? 0), 0);
    const previsto = previstoRH + previstoVR;

    // Recebido (realizado) no mês
    const recebidoRH = rhMes
      .filter((p: any) => p.status === "pago")
      .reduce((s, p: any) => s + Number(p.valor_recebido ?? p.valor_mensalidade ?? 0), 0);
    const recebidoVR = vrMes
      .filter((v: any) => v.status === "pago")
      .reduce((s, v: any) => s + Number(v.valor_recebido ?? v.valor_comissao ?? 0), 0);
    const recebido = recebidoRH + recebidoVR;
    const pctRealizado = previsto > 0 ? Math.min(100, Math.round((recebido / previsto) * 100)) : 0;

    return { recorrencia, previsto, recebido, pctRealizado };
  }, [contratosAtivosQ.data, vrMesQ.data, rhMesQ.data]);

  const comissoesAPagar = useMemo(
    () => (repassesPendQ.data ?? []).reduce((s, r: any) => s + Number(r.valor_repasse ?? 0), 0),
    [repassesPendQ.data],
  );

  // Fluxo de caixa — 6 meses
  const fluxoData = useMemo(() => {
    const hist = historicoQ.data ?? { vr: [], rh: [] };
    const out: { mes: string; key: string; receita: number; previsto: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(month, i);
      const key = format(d, "yyyy-MM");
      const recebidoVR = hist.vr
        .filter((v: any) => v.competencia?.slice(0, 7) === key && v.status === "pago")
        .reduce((s, v: any) => s + Number(v.valor_recebido ?? v.valor_comissao ?? 0), 0);
      const recebidoRH = hist.rh
        .filter((p: any) => p.competencia?.slice(0, 7) === key && p.status === "pago")
        .reduce((s, p: any) => s + Number(p.valor_recebido ?? p.valor_mensalidade ?? 0), 0);
      const previstoVR = hist.vr
        .filter((v: any) => v.competencia?.slice(0, 7) === key)
        .reduce((s, v: any) => s + Number(v.valor_comissao ?? 0), 0);
      const previstoRH = hist.rh
        .filter((p: any) => p.competencia?.slice(0, 7) === key)
        .reduce((s, p: any) => s + Number(p.valor_mensalidade ?? 0), 0);
      out.push({
        mes: format(d, "LLL/yy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
        key,
        receita: recebidoVR + recebidoRH,
        previsto: previstoVR + previstoRH,
      });
    }
    return out;
  }, [historicoQ.data, month]);

  // Saúde
  const saude = useMemo(() => {
    const arr = saudeQ.data ?? [];
    const hoje = format(new Date(), "yyyy-MM-dd");
    let emDia = 0;
    let parcial = 0;
    let atrasado = 0;
    arr.forEach((p: any) => {
      const valor = Number(p.valor_mensalidade ?? 0);
      const receb = Number(p.valor_recebido ?? 0);
      if (p.status === "pago") {
        if (valor > 0 && receb < valor) parcial++;
        else emDia++;
      } else if (p.competencia < hoje) {
        atrasado++;
      }
    });
    const total = emDia + parcial + atrasado;
    const pct = total > 0 ? Math.round((emDia / total) * 100) : 0;
    return { emDia, parcial, atrasado, total, pct };
  }, [saudeQ.data]);

  // Últimos lançamentos
  const ultimos = useMemo(() => {
    const u = ultimosQ.data ?? { vr: [], rh: [] };
    const vr = u.vr.map((r: any) => ({
      id: `vr-${r.id}`,
      cliente: r.cliente_nome,
      produto: "VR Benefícios",
      valor: Number(r.valor_recebido ?? r.valor_comissao ?? 0),
      vencimento: r.competencia,
      status: r.status as string,
    }));
    const rh = u.rh.map((r: any) => ({
      id: `rh-${r.id}`,
      cliente: r.cliente_nome,
      produto: "RH Digital",
      valor: Number(r.valor_recebido ?? r.valor_mensalidade ?? 0),
      vencimento: r.competencia,
      status: r.status as string,
    }));
    const hoje = format(new Date(), "yyyy-MM-dd");
    return [...vr, ...rh]
      .map((r) => ({
        ...r,
        status:
          r.status === "pago"
            ? "pago"
            : r.vencimento < hoje
              ? "atrasado"
              : "pendente",
      }))
      .sort((a, b) => (b.vencimento ?? "").localeCompare(a.vencimento ?? ""))
      .slice(0, 7);
  }, [ultimosQ.data]);

  const alerts = useMemo(() => {
    const now = new Date();
    return (alertsQuery.data ?? [])
      .map((a) => {
        const d = new Date(a.venc + "T00:00:00");
        const days = differenceInCalendarDays(d, now);
        return { ...a, days, vencido: days < 0 };
      })
      .filter((a) => a.vencido || a.days <= 30)
      .slice(0, 6);
  }, [alertsQuery.data]);

  const loading =
    vrMesQ.isLoading || rhMesQ.isLoading || contratosAtivosQ.isLoading || historicoQ.isLoading;

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Receita Recorrente"
          value={BRL.format(kpis.recorrencia)}
          hint="Contratos ativos + comissões VR do mês"
          tone="primary"
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Previsto para o Mês"
          value={BRL.format(kpis.previsto)}
          hint="Meta de faturamento mensal"
          tone="default"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Recebido (Realizado)"
          value={BRL.format(kpis.recebido)}
          tone="success"
          progress={kpis.pctRealizado}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Comissões a Pagar"
          value={BRL.format(comissoesAPagar)}
          hint="Aguardando fechamento"
          tone="warning"
          italic
        />
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

      {/* Grid principal — Fluxo de caixa + Saúde */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Fluxo de Caixa</h2>
              <p className="text-xs text-muted-foreground">Últimos 6 meses — receita realizada</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Recebido
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/30" /> Previsto
              </span>
            </div>
          </div>
          <div className="h-[280px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluxoData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="mes"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [BRL.format(value), name]}
                  />
                  <Bar dataKey="previsto" name="Previsto" fill="hsl(var(--muted-foreground) / 0.25)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="receita" name="Recebido" radius={[6, 6, 0, 0]}>
                    {fluxoData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.key === monthKey ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.55)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <h2 className="text-base font-semibold">Saúde dos Pagamentos</h2>
          <p className="text-xs text-muted-foreground">Últimos 60 dias</p>

          <div className="relative my-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Em dia", value: saude.emDia, fill: "hsl(var(--primary))" },
                    { name: "Parcial", value: saude.parcial, fill: "hsl(38 92% 50%)" },
                    { name: "Atrasados", value: saude.atrasado, fill: "hsl(var(--destructive))" },
                  ].filter((d) => d.value > 0)}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="hsl(var(--background))"
                  strokeWidth={3}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold tabular-nums">{saude.pct}%</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Em dia</div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <LegendRow color="bg-primary" label="Em dia" value={saude.emDia} />
            <LegendRow color="bg-amber-500" label="Parcial" value={saude.parcial} />
            <LegendRow color="bg-destructive" label="Atrasados" value={saude.atrasado} />
          </div>
        </Card>
      </div>

      {/* Grid inferior — Últimos lançamentos + Parceiros */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
            <h2 className="text-base font-semibold">Últimos Lançamentos</h2>
            <Link
              to="#"
              onClick={(e) => e.preventDefault()}
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Cliente</th>
                  <th className="px-5 py-2.5 text-left font-medium">Produto</th>
                  <th className="px-5 py-2.5 text-right font-medium">Valor</th>
                  <th className="px-5 py-2.5 text-left font-medium">Vencimento</th>
                  <th className="px-5 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ultimosQ.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                ) : ultimos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      Nenhum lançamento recente.
                    </td>
                  </tr>
                ) : (
                  ultimos.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/40 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-5 py-3 font-medium">{r.cliente}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.produto}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {BRL.format(r.valor)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatBRDate(r.vencimento)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
            <h2 className="text-base font-semibold">Parceiros</h2>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 divide-y divide-border/40">
            {repassesPendQ.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (repassesPendQ.data ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhum repasse pendente.
              </div>
            ) : (
              (repassesPendQ.data ?? []).slice(0, 4).map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {iniciais(r.parceiro_nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.parceiro_nome}</div>
                    <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                      {r.produto?.replace("_", " ") || "Repasse"} ·{" "}
                      {format(new Date(r.competencia + "T00:00:00"), "MMM/yy", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary tabular-nums">
                      {BRL.format(Number(r.valor_repasse ?? 0))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Pend. {format(new Date(r.competencia + "T00:00:00"), "dd/MM")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border bg-muted/20 p-3">
            <Button variant="outline" className="w-full" size="sm">
              Processar Pagamentos
            </Button>
          </div>
        </Card>
      </div>

      {/* FAB — Conciliação Bancária */}
      <button
        type="button"
        title="Conciliação Bancária"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:opacity-90 active:scale-95"
        onClick={() => {
          // hook futuro: abrir modal/route de conciliação
        }}
      >
        <Wallet className="h-6 w-6" />
      </button>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
  progress,
  italic,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning";
  progress?: number;
  italic?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/15 text-primary",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };
  return (
    <Card className="flex h-32 flex-col justify-between p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            toneClasses[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {progress != null ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-primary tabular-nums">{progress}%</span>
          </div>
        ) : hint ? (
          <div
            className={cn(
              "mt-1 text-xs text-muted-foreground",
              italic && "italic",
            )}
          >
            {hint}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-sm", color)} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pago: {
      label: "Pago",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    },
    pendente: {
      label: "Pendente",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
    atrasado: {
      label: "Atrasado",
      cls: "bg-destructive/15 text-destructive",
    },
    inadimplente: {
      label: "Inadimplente",
      cls: "bg-destructive/15 text-destructive",
    },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        v.cls,
      )}
    >
      {v.label}
    </span>
  );
}

function iniciais(nome?: string | null) {
  if (!nome) return "??";
  const parts = nome.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "??";
}
