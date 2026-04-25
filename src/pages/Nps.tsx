import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ImportNpsDialog } from "@/components/nps/ImportNpsDialog";
import { Star, Copy, Upload, Loader2 } from "lucide-react";
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

export default function Nps() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"30" | "90" | "180" | "all">("90");
  const [classFilter, setClassFilter] = useState<"all" | "promotor" | "neutro" | "detrator">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<NpsRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["nps-responses", period],
    queryFn: async () => {
      let q = supabase
        .from("nps_responses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (period !== "all") {
        const since = new Date();
        since.setDate(since.getDate() - parseInt(period));
        q = q.gte("created_at", since.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NpsRow[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (classFilter !== "all") {
      rows = rows.filter((r) => classify(r.nps_score) === classFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.nome.toLowerCase().includes(s) ||
          r.empresa.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s),
      );
    }
    return rows;
  }, [data, classFilter, search]);

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

    // Distribuição 0-10
    const dist = Array.from({ length: 11 }, (_, n) => ({
      score: n,
      count: npsScores.filter((s) => s === n).length,
    }));

    return {
      npsAvg: avg(npsScores),
      atendimentoAvg: avg(atendimento),
      confiancaAvg: avg(confianca),
      total: rows.length,
      dist,
    };
  }, [data]);

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

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pesquisa de Satisfação</h1>
          <p className="text-sm text-muted-foreground">
            NPS — avaliação do atendimento Nortear pelos clientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink}>
            <Copy className="mr-1.5 h-4 w-4" /> Copiar link do formulário
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Importar feedbacks
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard
          label="NPS médio"
          value={stats.npsAvg !== null ? stats.npsAvg.toFixed(1) : "—"}
          extra={
            stats.npsAvg !== null ? <NpsBadge score={Math.round(stats.npsAvg)} /> : null
          }
          icon={<Star className="h-4 w-4" />}
        />
        <KpiCard
          label="Nota média de atendimento"
          value={stats.atendimentoAvg !== null ? stats.atendimentoAvg.toFixed(1) : "—"}
        />
        <KpiCard
          label="Confiança média"
          value={stats.confiancaAvg !== null ? stats.confiancaAvg.toFixed(1) : "—"}
        />
        <KpiCard label="Total de respostas" value={String(stats.total)} />
      </div>

      {/* Distribuição */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Distribuição NPS</h2>
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dist} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="score"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
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

      {/* Filtros + tabela */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nome, empresa ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-xs"
          />
          <Select value={classFilter} onValueChange={(v) => setClassFilter(v as any)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as classificações</SelectItem>
              <SelectItem value="promotor">Promotores</SelectItem>
              <SelectItem value="neutro">Neutros</SelectItem>
              <SelectItem value="detrator">Detratores</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {filtered.length} resposta(s)
          </span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-center">NPS</TableHead>
                <TableHead className="text-center">Atendimento</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma resposta encontrada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <TableCell>
                    <div className="font-medium">{r.nome}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.empresa}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono font-semibold">
                        {r.nps_score ?? "—"}
                      </span>
                      <NpsBadge score={r.nps_score} />
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {r.nota_atendimento ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.source === "importado" ? "Importado" : "Formulário"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatBrazilDate(r.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

function KpiCard({
  label,
  value,
  extra,
  icon,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {extra}
      </div>
    </Card>
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
