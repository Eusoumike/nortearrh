import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ImportNpsDialog } from "@/components/nps/ImportNpsDialog";
import {
  Users,
  TrendingUp,
  Star,
  ShieldCheck,
  Copy,
  Upload,
  ThumbsUp,
  Minus,
  ThumbsDown,
  ArrowUpRight,
  Search,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatBrazilDateTime, formatBrazilDate } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

type NpsRow = {
  id: string;
  nome: string;
  email: string;
  empresa: string;
  tempo_cliente: string | null;
  frequencia_uso: string | null;
  nota_atendimento: number | null;
  atendimento_evolucao: string | null;
  tempo_resposta: string | null;
  confianca_informacoes: number | null;
  nps_score: number | null;
  feedback_aberto: string | null;
  experiencia_geral: string | null;
  sugestao_melhoria: string | null;
  comentario_adicional: string | null;
  client_id: string | null;
  source: string;
  created_at: string;
};

type Period = "7" | "30" | "90" | "year" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  "7": "Últimos 7 dias",
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  year: "Este ano",
  all: "Todo o período",
};

type ListClassification = "all" | "promotor" | "neutro" | "detrator";
type ListPeriod = "7" | "30" | "90" | "year" | "all";

function classify(score: number | null): "promotor" | "neutro" | "detrator" | "—" {
  if (score === null || score === undefined) return "—";
  if (score >= 9) return "promotor";
  if (score >= 7) return "neutro";
  return "detrator";
}

function NpsBadge({ score }: { score: number | null }) {
  const c = classify(score);
  if (c === "promotor")
    return <Badge className="bg-success/15 text-success hover:bg-success/15">Promotor</Badge>;
  if (c === "neutro")
    return <Badge className="bg-warning/15 text-warning hover:bg-warning/15">Neutro</Badge>;
  if (c === "detrator")
    return (
      <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">
        Detrator
      </Badge>
    );
  return <Badge variant="outline">—</Badge>;
}

interface KPIProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "warning" | "danger" | "success";
}

function KPI({ label, value, hint, icon: Icon, tone = "primary" }: KPIProps) {
  const toneStyles = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <Card className="group relative flex h-full min-h-[140px] flex-col overflow-hidden p-5 transition-all">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneStyles}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <div className="mt-auto pt-2">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}

function ClassCard({
  label,
  count,
  total,
  tone,
  icon: Icon,
  description,
}: {
  label: string;
  count: number;
  total: number;
  tone: "success" | "warning" | "danger";
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const toneMap = {
    success: { border: "border-success/40", iconBg: "bg-success/10 text-success", text: "text-success" },
    warning: { border: "border-warning/40", iconBg: "bg-warning/15 text-warning", text: "text-warning" },
    danger: { border: "border-destructive/40", iconBg: "bg-destructive/10 text-destructive", text: "text-destructive" },
  }[tone];
  return (
    <Card className={`flex h-full flex-col p-5 ${toneMap.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneMap.iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-mono text-3xl font-semibold tracking-tight">{count}</span>
        <span className={`mb-1 text-sm font-semibold ${toneMap.text}`}>{pct}%</span>
      </div>
      <p className="mt-auto pt-2 text-xs text-muted-foreground">
        {count} avaliação{count === 1 ? "" : "es"}
      </p>
    </Card>
  );
}

export default function Nps() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("90");
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<NpsRow | null>(null);
  const [deleting, setDeleting] = useState<NpsRow | null>(null);

  // Filtros da listagem de feedbacks
  const [listPeriod, setListPeriod] = useState<ListPeriod>("all");
  const [listClass, setListClass] = useState<ListClassification>("all");
  const [listSearch, setListSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["nps-responses", period],
    queryFn: async () => {
      let q = supabase
        .from("nps_responses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (period === "7" || period === "30" || period === "90") {
        const since = new Date();
        since.setDate(since.getDate() - parseInt(period));
        q = q.gte("created_at", since.toISOString());
      } else if (period === "year") {
        const since = new Date(new Date().getFullYear(), 0, 1);
        q = q.gte("created_at", since.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NpsRow[];
    },
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const npsScores = rows.map((r) => r.nps_score).filter((n): n is number => n !== null);
    const atendimento = rows
      .map((r) => r.nota_atendimento)
      .filter((n): n is number => n !== null);
    const confianca = rows
      .map((r) => r.confianca_informacoes)
      .filter((n): n is number => n !== null);
    const avg = (arr: number[]) =>
      arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

    // NPS Score (formula: % promotores - % detratores)
    const promotores = npsScores.filter((s) => s >= 9).length;
    const neutros = npsScores.filter((s) => s >= 7 && s <= 8).length;
    const detratores = npsScores.filter((s) => s <= 6).length;
    const totalNps = npsScores.length;
    const npsScore =
      totalNps > 0 ? Math.round(((promotores - detratores) / totalNps) * 100) : null;

    // Distribuição 0-10
    const dist = Array.from({ length: 11 }, (_, n) => ({
      score: n,
      count: npsScores.filter((s) => s === n).length,
    }));

    // Evolução por mês (últimos 6 meses)
    const months: { month: string; atendimento: number | null; confianca: number | null; nps: number | null }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthRows = rows.filter((r) => {
        const c = new Date(r.created_at);
        return c >= start && c < end;
      });
      const a = avg(monthRows.map((r) => r.nota_atendimento).filter((n): n is number => n !== null));
      const c = avg(monthRows.map((r) => r.confianca_informacoes).filter((n): n is number => n !== null));
      const n = avg(monthRows.map((r) => r.nps_score).filter((n): n is number => n !== null));
      months.push({
        month: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        atendimento: a !== null ? Number(a.toFixed(1)) : null,
        confianca: c !== null ? Number(c.toFixed(1)) : null,
        nps: n !== null ? Number(n.toFixed(1)) : null,
      });
    }

    // Tempo de resposta
    const tempoResposta: Record<string, number> = {
      "Muito rápido": 0,
      Rápido: 0,
      Adequado: 0,
      Lento: 0,
      "Muito lento": 0,
    };
    rows.forEach((r) => {
      if (r.tempo_resposta && tempoResposta[r.tempo_resposta] !== undefined) {
        tempoResposta[r.tempo_resposta]++;
      }
    });

    // Evolução do atendimento
    const evolucao: Record<string, number> = {
      "Melhorou muito": 0,
      Melhorou: 0,
      "Manteve igual": 0,
      Piorou: 0,
      "Piorou muito": 0,
    };
    rows.forEach((r) => {
      if (r.atendimento_evolucao && evolucao[r.atendimento_evolucao] !== undefined) {
        evolucao[r.atendimento_evolucao]++;
      }
    });

    return {
      npsAvg: avg(npsScores),
      npsScore,
      atendimentoAvg: avg(atendimento),
      confiancaAvg: avg(confianca),
      total: rows.length,
      promotores,
      neutros,
      detratores,
      totalNps,
      dist,
      months,
      tempoResposta,
      evolucao,
    };
  }, [data]);

  // Lista filtrada de feedbacks (filtros independentes do período do dashboard)
  const filteredFeedbacks = useMemo(() => {
    const rows = data ?? [];
    const now = Date.now();
    let cutoff: number | null = null;
    if (listPeriod === "7" || listPeriod === "30" || listPeriod === "90") {
      cutoff = now - parseInt(listPeriod) * 86400000;
    } else if (listPeriod === "year") {
      cutoff = new Date(new Date().getFullYear(), 0, 1).getTime();
    }
    const needle = listSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (cutoff !== null && new Date(r.created_at).getTime() < cutoff) return false;
      if (listClass !== "all" && classify(r.nps_score) !== listClass) return false;
      if (needle) {
        const hay = [
          r.nome,
          r.empresa,
          r.email,
          r.feedback_aberto,
          r.experiencia_geral,
          r.sugestao_melhoria,
          r.comentario_adicional,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, listPeriod, listClass, listSearch]);

  const visibleFeedbacks = useMemo(
    () => (showAll ? filteredFeedbacks : filteredFeedbacks.slice(0, 6)),
    [filteredFeedbacks, showAll],
  );

  const copyLink = () => {
    const url = `${window.location.origin}/pesquisa`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado: " + url);
  };

  const importMut = useMutation({
    mutationFn: async (rows: Partial<NpsRow>[]) => {
      const payload = rows.map((r) => ({ ...r, source: "importado" }));
      const { error } = await supabase.from("nps_responses").insert(payload as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} registro(s) importado(s) com sucesso.`);
      qc.invalidateQueries({ queryKey: ["nps-responses"] });
      setImportOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nps_responses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação excluída.");
      qc.invalidateQueries({ queryKey: ["nps-responses"] });
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  // NPS Score tone
  const npsScoreTone: "success" | "warning" | "danger" | "primary" =
    stats.npsScore === null
      ? "primary"
      : stats.npsScore >= 70
        ? "success"
        : stats.npsScore >= 50
          ? "warning"
          : "danger";

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Pesquisa de Satisfação — NPS
          </h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            {stats.total} resposta{stats.total === 1 ? "" : "s"} · {PERIOD_LABEL[period]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={copyLink}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar link
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Importar feedbacks
          </Button>
        </div>
      </div>

      {/* LINHA 1 — KPIs principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Total de avaliações"
          value={stats.total}
          icon={Users}
          tone="primary"
          hint={stats.totalNps > 0 ? `${stats.totalNps} com NPS` : undefined}
        />
        <KPI
          label="NPS Score"
          value={stats.npsScore !== null ? stats.npsScore : "—"}
          icon={TrendingUp}
          tone={npsScoreTone}
          hint={
            stats.npsScore === null
              ? "Sem respostas"
              : stats.npsScore >= 70
                ? "Excelente"
                : stats.npsScore >= 50
                  ? "Bom"
                  : stats.npsScore >= 0
                    ? "Pode melhorar"
                    : "Crítico"
          }
        />
        <KPI
          label="Nota média atendimento"
          value={stats.atendimentoAvg !== null ? stats.atendimentoAvg.toFixed(1) : "—"}
          icon={Star}
          tone="primary"
          hint="Escala de 0 a 10"
        />
        <KPI
          label="Confiança média"
          value={stats.confiancaAvg !== null ? stats.confiancaAvg.toFixed(1) : "—"}
          icon={ShieldCheck}
          tone="primary"
          hint="Confiança nas informações"
        />
      </div>

      {/* LINHA 2 — Distribuição Promotor/Neutro/Detrator */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ClassCard
          label="Promotores"
          description="Notas 9 e 10"
          count={stats.promotores}
          total={stats.totalNps}
          tone="success"
          icon={ThumbsUp}
        />
        <ClassCard
          label="Neutros"
          description="Notas 7 e 8"
          count={stats.neutros}
          total={stats.totalNps}
          tone="warning"
          icon={Minus}
        />
        <ClassCard
          label="Detratores"
          description="Notas de 0 a 6"
          count={stats.detratores}
          total={stats.totalNps}
          tone="danger"
          icon={ThumbsDown}
        />
      </div>

      {/* LINHA 3 — Gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex h-full flex-col p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Evolução das notas</h2>
            <p className="text-xs text-muted-foreground">Médias mensais nos últimos 6 meses</p>
          </div>
          <div className="h-72 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="atendimento"
                  name="Atendimento"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="confianca"
                  name="Confiança"
                  stroke="hsl(var(--info))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="nps"
                  name="NPS"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex h-full flex-col p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Distribuição NPS</h2>
            <p className="text-xs text-muted-foreground">Quantidade de respostas por nota</p>
          </div>
          <div className="h-72 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dist}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="score"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => `Nota ${l}`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.dist.map((d) => (
                    <Cell
                      key={d.score}
                      fill={
                        d.score >= 9
                          ? "hsl(var(--success))"
                          : d.score >= 7
                            ? "hsl(var(--warning))"
                            : "hsl(var(--destructive))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* LINHA 4 — Painéis qualitativos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex h-full flex-col p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Percepção do tempo de resposta</h2>
            <p className="text-xs text-muted-foreground">Como os clientes avaliam a velocidade</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(stats.tempoResposta).map(([label, count]) => (
              <div
                key={label}
                className="rounded-md border border-border bg-surface-muted/40 p-3"
              >
                <p className="font-mono text-xl font-semibold">{count}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex h-full flex-col p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Evolução do atendimento</h2>
            <p className="text-xs text-muted-foreground">Como o atendimento mudou ao longo do tempo</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(stats.evolucao).map(([label, count]) => (
              <div
                key={label}
                className="rounded-md border border-border bg-surface-muted/40 p-3"
              >
                <p className="font-mono text-xl font-semibold">{count}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* LINHA 5 — Feedbacks com filtros */}
      <Card className="flex flex-col p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Feedbacks</h2>
            <p className="text-xs text-muted-foreground">
              {filteredFeedbacks.length} resultado{filteredFeedbacks.length === 1 ? "" : "s"}
              {!showAll && filteredFeedbacks.length > visibleFeedbacks.length
                ? ` · exibindo ${visibleFeedbacks.length}`
                : ""}
            </p>
          </div>
        </div>

        {/* Filtros da listagem */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full flex-1 sm:min-w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Buscar por nome, empresa ou feedback…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={listPeriod} onValueChange={(v) => setListPeriod(v as ListPeriod)}>
            <SelectTrigger className="h-9 w-full sm:w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={listClass} onValueChange={(v) => setListClass(v as ListClassification)}>
            <SelectTrigger className="h-9 w-full sm:w-[180px]">
              <SelectValue placeholder="Classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas classificações</SelectItem>
              <SelectItem value="promotor">Promotores (9-10)</SelectItem>
              <SelectItem value="neutro">Neutros (7-8)</SelectItem>
              <SelectItem value="detrator">Detratores (0-6)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredFeedbacks.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum feedback encontrado com os filtros selecionados.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {visibleFeedbacks.map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-border bg-background p-4 transition-colors hover:bg-surface-muted/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.nome}</p>
                      <p className="text-xs text-muted-foreground">{r.empresa}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <NpsBadge score={r.nps_score} />
                      <span className="font-mono text-sm font-semibold">
                        {r.nps_score ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatBrazilDate(r.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Todos os campos textuais preenchidos */}
                  <div className="mt-3 space-y-2">
                    {r.feedback_aberto && (
                      <FeedbackBlock label="Experiência" value={r.feedback_aberto} quoted />
                    )}
                    {r.experiencia_geral && (
                      <FeedbackBlock label="Experiência geral" value={r.experiencia_geral} />
                    )}
                    {r.sugestao_melhoria && (
                      <FeedbackBlock label="Sugestão de melhoria" value={r.sugestao_melhoria} />
                    )}
                    {r.comentario_adicional && (
                      <FeedbackBlock label="Comentário adicional" value={r.comentario_adicional} />
                    )}
                    {!r.feedback_aberto &&
                      !r.experiencia_geral &&
                      !r.sugestao_melhoria &&
                      !r.comentario_adicional && (
                        <p className="text-xs italic text-muted-foreground/70">
                          Sem comentários textuais.
                        </p>
                      )}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleting(r)}
                    >
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-primary hover:text-primary"
                      onClick={() => setSelected(r)}
                    >
                      Ver detalhes <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filteredFeedbacks.length > 6 && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll
                    ? "Mostrar menos"
                    : `Ver todos os feedbacks (${filteredFeedbacks.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <ImportNpsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(rows) => importMut.mutate(rows)}
        isImporting={importMut.isPending}
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <ResponseDetails row={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ResponseDetails({ row }: { row: NpsRow }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {row.nome}
          <NpsBadge score={row.nps_score} />
        </SheetTitle>
        <SheetDescription>
          {row.empresa} · {formatBrazilDateTime(row.created_at)}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-5 space-y-5">
        <Section title="Contato">
          <Field label="Email" value={row.email} />
          <Field label="Tempo como cliente" value={row.tempo_cliente} />
          <Field label="Frequência de uso" value={row.frequencia_uso} />
        </Section>

        <Section title="Avaliação">
          <Field
            label="NPS"
            value={row.nps_score !== null ? `${row.nps_score}/10` : null}
          />
          <Field
            label="Nota de atendimento"
            value={row.nota_atendimento !== null ? `${row.nota_atendimento}/10` : null}
          />
          <Field
            label="Confiança nas informações"
            value={
              row.confianca_informacoes !== null
                ? `${row.confianca_informacoes}/10`
                : null
            }
          />
          <Field label="Evolução do atendimento" value={row.atendimento_evolucao} />
          <Field label="Tempo de resposta" value={row.tempo_resposta} />
        </Section>

        <Section title="Feedbacks">
          <LongField label="Experiência" value={row.feedback_aberto} />
          <LongField label="Experiência geral" value={row.experiencia_geral} />
          <LongField label="Sugestão de melhoria" value={row.sugestao_melhoria} />
          <LongField label="Comentário adicional" value={row.comentario_adicional} />
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function LongField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="rounded-md bg-surface-muted/50 p-3 text-sm">{value}</p>
    </div>
  );
}

function FeedbackBlock({
  label,
  value,
  quoted = false,
}: {
  label: string;
  value: string;
  quoted?: boolean;
}) {
  return (
    <div className="rounded-md bg-surface-muted/50 p-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm text-foreground/90">
        {quoted ? `"${value}"` : value}
      </p>
    </div>
  );
}
