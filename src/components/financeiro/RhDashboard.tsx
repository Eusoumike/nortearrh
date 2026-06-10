import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, startOfMonth } from "date-fns";
import {
  FileText,
  Users,
  DollarSign,
  Infinity as InfinityIcon,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BRL, formatBRDate } from "./financeiroUtils";
import { cn } from "@/lib/utils";

const REFETCH_MS = 5 * 60 * 1000;

type ContratoDash = {
  id: string;
  client_id: string | null;
  cliente_nome: string;
  valor_mensalidade: number;
  fidelidade_vencimento: string | null;
  tipo_periodo: "fidelidade" | "enquanto_ativo";
  tipo_cobranca: "mensal" | "anual";
  fidelidade_meses: number | null;
  ativo: boolean;
  created_at: string;
  clients?: { contact_name: string | null; contact_phone: string | null } | null;
};

export function RhDashboard({ onVerTodos }: { onVerTodos?: () => void }) {
  const startMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const contratosQ = useQuery({
    queryKey: ["rh-dashboard-contratos"],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_rh_digital")
        .select(
          "id, client_id, cliente_nome, valor_mensalidade, fidelidade_vencimento, tipo_periodo, tipo_cobranca, fidelidade_meses, ativo, created_at, clients:client_id ( contact_name, contact_phone )",
        )
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as unknown as ContratoDash[];
    },
  });

  const clientesQ = useQuery({
    queryKey: ["rh-dashboard-clientes-count"],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const contratos = contratosQ.data ?? [];

  const stats = useMemo(() => {
    const total = contratos.length;
    const novosMes = contratos.filter((c) => c.created_at >= startMonth).length;
    const mrr = contratos.reduce(
      (s, c) => s + (c.tipo_cobranca === "anual" ? 0 : Number(c.valor_mensalidade || 0)),
      0,
    );
    const semVenc = contratos.filter((c) => c.tipo_periodo === "enquanto_ativo").length;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencendo: Array<ContratoDash & { dias: number }> = [];
    const vencidos: Array<ContratoDash & { dias: number }> = [];
    contratos.forEach((c) => {
      if (c.tipo_periodo !== "fidelidade" || !c.fidelidade_vencimento) return;
      const d = new Date(c.fidelidade_vencimento + "T00:00:00");
      const dias = differenceInCalendarDays(d, hoje);
      if (dias < 0) vencidos.push({ ...c, dias });
      else if (dias <= 30) vencendo.push({ ...c, dias });
    });
    vencendo.sort((a, b) => a.dias - b.dias);
    vencidos.sort((a, b) => a.dias - b.dias);

    const dist = [
      {
        name: "Mensal 6 meses",
        value: contratos.filter(
          (c) => c.tipo_periodo === "fidelidade" && c.fidelidade_meses === 6,
        ).length,
        color: "hsl(var(--chart-1, 220 70% 55%))",
      },
      {
        name: "Mensal 12 meses",
        value: contratos.filter(
          (c) => c.tipo_periodo === "fidelidade" && c.fidelidade_meses === 12,
        ).length,
        color: "hsl(var(--chart-2, 160 60% 45%))",
      },
      {
        name: "Anual",
        value: contratos.filter((c) => c.tipo_cobranca === "anual").length,
        color: "hsl(var(--chart-3, 30 80% 55%))",
      },
      {
        name: "Enquanto ativo",
        value: semVenc,
        color: "hsl(var(--chart-4, 280 60% 60%))",
      },
    ].filter((d) => d.value > 0);

    return { total, novosMes, mrr, semVenc, vencendo, vencidos, dist };
  }, [contratos, startMonth]);

  const refetchAll = () => {
    contratosQ.refetch();
    clientesQ.refetch();
  };

  const isLoading = contratosQ.isLoading || clientesQ.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Visão geral — RH Digital
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={refetchAll}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<FileText className="h-4 w-4" />}
          label="Contratos Ativos"
          value={stats.total.toString()}
          hint={stats.novosMes > 0 ? `+${stats.novosMes} este mês` : "Sem novos este mês"}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Clientes na Carteira"
          value={(clientesQ.data ?? 0).toString()}
          hint="Total base"
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="MRR RH Digital"
          value={BRL.format(stats.mrr)}
          hint="mensal recorrente"
        />
        <KpiCard
          icon={<InfinityIcon className="h-4 w-4" />}
          label="Sem Vencimento"
          value={stats.semVenc.toString()}
          hint="enquanto ativo"
        />
      </div>

      {/* Alertas */}
      {stats.vencendo.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {stats.vencendo.length} contrato{stats.vencendo.length === 1 ? "" : "s"} com
                  fidelidade vencendo em 30 dias
                </p>
                {onVerTodos && (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={onVerTodos}>
                    Ver todos →
                  </Button>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {stats.vencendo.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-foreground">{c.cliente_nome}</span>
                    {c.clients?.contact_name ? ` · ${c.clients.contact_name}` : ""}
                    {" · "}
                    Vence em {c.dias} dia{c.dias === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {stats.vencidos.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {stats.vencidos.length} contrato{stats.vencidos.length === 1 ? "" : "s"} com
                fidelidade vencida
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {stats.vencidos.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-foreground">{c.cliente_nome}</span>
                    {" · "}
                    Venceu em {formatBRDate(c.fidelidade_vencimento)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Distribuição por plano */}
      {stats.dist.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Distribuição por plano</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.dist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {stats.dist.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
