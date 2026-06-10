import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Phone,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BRL, formatBRDate, ymdFirst } from "./financeiroUtils";
import { cn } from "@/lib/utils";

const REFETCH_MS = 5 * 60 * 1000;

type Parcela = {
  id: string;
  contrato_id: string;
  competencia: string;
  valor_mensalidade: number;
  valor_nortear: number;
  valor_recebido: number | null;
  valor_nortear_recebido: number | null;
  status: "pendente" | "pago" | "inadimplente";
};

type ContratoAtivo = {
  id: string;
  cliente_nome: string;
  valor_mensalidade: number;
  valor_nortear: number;
  percentual_nortear: number;
  fidelidade_vencimento: string | null;
  tipo_periodo: "fidelidade" | "enquanto_ativo";
  clients?: { contact_name: string | null; contact_phone: string | null } | null;
};

type Props = {
  month: Date;
  onVerInadimplencia?: () => void;
  onVerContratos?: () => void;
  onVerRepasses?: () => void;
};

export function RhDashboard({ month, onVerInadimplencia, onVerContratos, onVerRepasses }: Props) {
  const competencia = ymdFirst(month);
  const monthLabel = format(month, "LLLL/yy", { locale: ptBR });
  const inicioMesAtual = ymdFirst(startOfMonth(new Date()));

  // Contratos ativos (sempre baseado em hoje, não no mês selecionado)
  const contratosQ = useQuery({
    queryKey: ["rh-dash-contratos"],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_rh_digital")
        .select(
          "id, client_id, cliente_nome, valor_mensalidade, valor_nortear, percentual_nortear, fidelidade_vencimento, tipo_periodo",
        )
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as unknown as (ContratoAtivo & { client_id: string | null })[];
    },
  });

  // Mapa de telefones por client_id (usado para enriquecer atrasos)
  const clientIds = useMemo(
    () =>
      Array.from(
        new Set(((contratosQ.data ?? []) as any[]).map((c) => c.client_id).filter(Boolean)),
      ) as string[],
    [contratosQ.data],
  );

  const clientesQ = useQuery({
    queryKey: ["rh-dash-clientes-phone", clientIds.join(",")],
    enabled: clientIds.length > 0,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, contact_name, contact_phone")
        .in("id", clientIds);
      if (error) throw error;
      const map = new Map<string, { contact_name: string | null; contact_phone: string | null }>();
      (data ?? []).forEach((c: any) =>
        map.set(c.id, { contact_name: c.contact_name, contact_phone: c.contact_phone }),
      );
      return map;
    },
  });

  // Parcelas do mês selecionado
  const parcelasMesQ = useQuery({
    queryKey: ["rh-dash-parcelas-mes", competencia],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select(
          "id, contrato_id, competencia, valor_mensalidade, valor_nortear, valor_recebido, valor_nortear_recebido, status",
        )
        .eq("competencia", competencia);
      if (error) throw error;
      return (data ?? []) as Parcela[];
    },
  });

  // Parcelas em atraso (de meses anteriores ao atual, ainda pendentes ou inadimplentes)
  const atrasoQ = useQuery({
    queryKey: ["rh-dash-atraso", inicioMesAtual],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select(
          "id, contrato_id, client_id, cliente_nome, competencia, valor_mensalidade, valor_nortear, status",
        )
        .in("status", ["pendente", "inadimplente"])
        .lt("competencia", inicioMesAtual)
        .order("competencia", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });


  // Repasses pendentes RH
  const repassesQ = useQuery({
    queryKey: ["rh-dash-repasses"],
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repasses_parceiro")
        .select("valor_repasse")
        .eq("status", "pendente")
        .eq("produto", "rh_digital");
      if (error) throw error;
      return data ?? [];
    },
  });

  const contratos = contratosQ.data ?? [];
  const parcelasMes = parcelasMesQ.data ?? [];
  const atrasos = atrasoQ.data ?? [];
  const repasses = repassesQ.data ?? [];

  const kpis = useMemo(() => {
    const totalContratos = contratos.length;
    const semVencimento = contratos.filter((c) => c.tipo_periodo === "enquanto_ativo").length;

    const pagas = parcelasMes.filter((p) => p.status === "pago");
    const pendentes = parcelasMes.filter((p) => p.status === "pendente");

    const recebido = pagas.reduce(
      (s, p) => s + Number(p.valor_recebido ?? p.valor_mensalidade ?? 0),
      0,
    );
    const aReceber = pendentes.reduce((s, p) => s + Number(p.valor_mensalidade ?? 0), 0);
    const comissao = pagas.reduce(
      (s, p) => s + Number(p.valor_nortear_recebido ?? p.valor_nortear ?? 0),
      0,
    );

    return {
      totalContratos,
      semVencimento,
      recebido,
      recebidoQtd: pagas.length,
      aReceber,
      aReceberQtd: pendentes.length,
      comissao,
    };
  }, [contratos, parcelasMes]);

  const atrasoStats = useMemo(() => {
    const total = atrasos.reduce((s, p: any) => s + Number(p.valor_mensalidade ?? 0), 0);
    return { total, qtd: atrasos.length };
  }, [atrasos]);

  const fidVencendo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return contratos
      .filter((c) => c.tipo_periodo === "fidelidade" && c.fidelidade_vencimento)
      .map((c) => ({
        ...c,
        dias: differenceInCalendarDays(new Date(c.fidelidade_vencimento + "T00:00:00"), hoje),
      }))
      .filter((c) => c.dias >= 0 && c.dias <= 30)
      .sort((a, b) => a.dias - b.dias);
  }, [contratos]);

  const repasseTotal = repasses.reduce((s, r: any) => s + Number(r.valor_repasse ?? 0), 0);

  const totaisGerais = useMemo(() => {
    const totalMensalidades = contratos.reduce(
      (s, c) => s + Number(c.valor_mensalidade ?? 0),
      0,
    );
    const totalComissao = contratos.reduce((s, c) => s + Number(c.valor_nortear ?? 0), 0);
    const taxa = totalMensalidades > 0 ? (totalComissao / totalMensalidades) * 100 : 0;
    return { totalMensalidades, totalComissao, taxa };
  }, [contratos]);

  const isLoading =
    contratosQ.isFetching || parcelasMesQ.isFetching || atrasoQ.isFetching || repassesQ.isFetching;

  const refetchAll = () => {
    contratosQ.refetch();
    parcelasMesQ.refetch();
    atrasoQ.refetch();
    repassesQ.refetch();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Painel financeiro — RH Digital
          </h2>
          <p className="text-xs text-muted-foreground">
            Valores de recebimento referentes a <span className="capitalize">{monthLabel}</span>
          </p>
        </div>
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

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<FileText className="h-4 w-4" />}
          label="Contratos Ativos"
          value={kpis.totalContratos.toString()}
          hint={
            kpis.semVencimento > 0
              ? `${kpis.semVencimento} sem vencimento`
              : "Todos com fidelidade"
          }
          tone="default"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Recebido no Mês"
          value={BRL.format(kpis.recebido)}
          hint={`${kpis.recebidoQtd} parcela${kpis.recebidoQtd === 1 ? "" : "s"}`}
          tone="success"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="A Receber no Mês"
          value={BRL.format(kpis.aReceber)}
          hint={`${kpis.aReceberQtd} parcela${kpis.aReceberQtd === 1 ? "" : "s"}`}
          tone="warning"
        />
        <KpiCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Comissão Nortear"
          value={BRL.format(kpis.comissao)}
          hint="do mês selecionado"
          tone="info"
        />
      </div>

      {/* Alertas operacionais */}
      <div className="grid gap-3">
        {atrasoStats.qtd > 0 && (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {atrasoStats.qtd} parcela{atrasoStats.qtd === 1 ? "" : "s"} em atraso —{" "}
                    {BRL.format(atrasoStats.total)}
                  </p>
                  {onVerInadimplencia && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-destructive"
                      onClick={onVerInadimplencia}
                    >
                      Ver todas em atraso →
                    </Button>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {atrasos.slice(0, 5).map((p: any) => {
                    const phone =
                      (p.client_id && clientesQ.data?.get(p.client_id)?.contact_phone) ?? null;

                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium text-foreground">{p.cliente_nome}</span>
                        <span>·</span>
                        <span className="capitalize">
                          {format(new Date(p.competencia + "T00:00:00"), "MMM/yy", {
                            locale: ptBR,
                          })}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {BRL.format(Number(p.valor_mensalidade ?? 0))}
                        </span>
                        {phone && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {phone}
                            </span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {fidVencendo.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {fidVencendo.length} contrato{fidVencendo.length === 1 ? "" : "s"} com
                    fidelidade vencendo em 30 dias
                  </p>
                  {onVerContratos && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-amber-700 dark:text-amber-400"
                      onClick={onVerContratos}
                    >
                      Ver contratos →
                    </Button>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {fidVencendo.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium text-foreground">{c.cliente_nome}</span>
                      <span>·</span>
                      <span>
                        Vence em {c.dias} dia{c.dias === 1 ? "" : "s"} (
                        {formatBRDate(c.fidelidade_vencimento)})
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {BRL.format(Number(c.valor_mensalidade ?? 0))}/mês
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {repasseTotal > 0 && (
          <Card className="border-sky-500/40 bg-sky-500/5 p-4">
            <div className="flex items-start gap-3">
              <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="flex flex-1 items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {BRL.format(repasseTotal)} em repasses pendentes a parceiros
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {repasses.length} pagamento{repasses.length === 1 ? "" : "s"} a realizar
                  </p>
                </div>
                {onVerRepasses && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-sky-700 dark:text-sky-400"
                    onClick={onVerRepasses}
                  >
                    Ver repasses →
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Totais gerais */}
      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Totalzinho
            label="Total mensalidades (ativos)"
            value={BRL.format(totaisGerais.totalMensalidades)}
          />
          <Totalzinho
            label="Comissão Nortear esperada/mês"
            value={BRL.format(totaisGerais.totalComissao)}
          />
          <Totalzinho
            label="Taxa média de comissão"
            value={`${totaisGerais.taxa.toFixed(2).replace(".", ",")}%`}
          />
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "info";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-muted text-foreground",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            toneClasses[tone],
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Totalzinho({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
