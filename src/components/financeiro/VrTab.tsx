import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
  Coins,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { PreencherValorRecorrenciaDialog } from "./PreencherValorRecorrenciaDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { LancamentoVrDialog, LancamentoVR } from "./LancamentoVrDialog";
import { BRL, formatBRDate, vencimentoTone, ymdFirst } from "./financeiroUtils";
import { StatusFilterChips, type StatusFilter } from "./StatusFilterChips";
import { formatCnpj, formatPercent } from "@/lib/formatters";


type Row = LancamentoVR & { valor_comissao: number | null };

export function VrTab() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LancamentoVR | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [toFill, setToFill] = useState<Row | null>(null);
  const [toCancel, setToCancel] = useState<{ client_id: string; cliente_nome: string; primeira_carga_id?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFilter>("todos");


  const competencia = ymdFirst(month);
  const monthLabel = format(month, "LLLL / yyyy", { locale: ptBR }).replace(
    /^./,
    (c) => c.toUpperCase(),
  );

  const { data = [], isLoading } = useQuery({
    queryKey: ["financeiro-vr-tab", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_vr")
        .select(
          "id, client_id, cliente_nome, cnpj, competencia, tipo, valor_base, percentual_comissao, valor_comissao, fidelidade_meses, fidelidade_inicio, fidelidade_vencimento, notificar_vencimento, observacoes",
        )
        .eq("competencia", competencia)
        .order("valor_comissao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Row & { fidelidade_vencimento: string | null })[];
    },
  });

  const searchFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    const digits = term.replace(/\D/g, "");
    return data.filter((r) => {
      const nameMatch = r.cliente_nome?.toLowerCase().includes(term);
      const cnpjMatch = digits && r.cnpj && r.cnpj.replace(/\D/g, "").includes(digits);
      return nameMatch || cnpjMatch;
    });
  }, [data, search]);

  // VR não possui "pago/pendente" formal: tratamos "Aguardando valor" (valor_base null)
  // como pendente e "valor preenchido" como pago.
  const counts = useMemo(() => {
    const pendentes = searchFiltered.filter((r) => r.valor_base == null).length;
    const pagos = searchFiltered.filter((r) => r.valor_base != null).length;
    return { todos: searchFiltered.length, pendentes, pagos };
  }, [searchFiltered]);

  const filteredData = useMemo(() => {
    if (filtroStatus === "pendentes") return searchFiltered.filter((r) => r.valor_base == null);
    if (filtroStatus === "pagos") return searchFiltered.filter((r) => r.valor_base != null);
    return searchFiltered;
  }, [searchFiltered, filtroStatus]);

  const totalBase = useMemo(
    () => filteredData.reduce((s, r) => s + Number(r.valor_base ?? 0), 0),
    [filteredData],
  );
  const totalComissao = useMemo(
    () => filteredData.reduce((s, r) => s + Number(r.valor_comissao ?? 0), 0),
    [filteredData],
  );
  const totalBasePendente = useMemo(
    () => searchFiltered.filter((r) => r.valor_base == null).length, // contador apenas
    [searchFiltered],
  );
  const totalComissaoPagos = useMemo(
    () =>
      searchFiltered
        .filter((r) => r.valor_base != null)
        .reduce((s, r) => s + Number(r.valor_comissao ?? 0), 0),
    [searchFiltered],
  );

  const vencidos = filteredData.filter((r) => vencimentoTone(r.fidelidade_vencimento) === "danger");
  const proximos = filteredData.filter((r) => vencimentoTone(r.fidelidade_vencimento) === "warning");


  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos_vr").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["financeiro-vr"] });
      qc.invalidateQueries({ queryKey: ["financeiro-vr-tab"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidade-alertas"] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const cancelMut = useMutation({
    mutationFn: async (payload: { client_id: string; primeira_carga_id?: string }) => {
      const today = format(new Date(), "yyyy-MM-dd");
      // 1) Remove recorrências futuras pendentes (sem valor preenchido)
      const { error: delErr, count } = await supabase
        .from("lancamentos_vr")
        .delete({ count: "exact" })
        .eq("client_id", payload.client_id)
        .eq("tipo", "recorrencia")
        .is("valor_base", null)
        .gt("competencia", today);
      if (delErr) throw delErr;

      // 2) Marca a primeira carga como encerrada via observações
      if (payload.primeira_carga_id) {
        const dataStr = format(new Date(), "dd/MM/yyyy");
        const { error: upErr } = await supabase
          .from("lancamentos_vr")
          .update({ observacoes: `Contrato VR encerrado em ${dataStr}` })
          .eq("id", payload.primeira_carga_id);
        if (upErr) throw upErr;
      }
      return count ?? 0;
    },
    onSuccess: () => {
      toast.success("Contrato VR encerrado. Recorrências futuras removidas.");
      qc.invalidateQueries({ queryKey: ["financeiro-vr"] });
      qc.invalidateQueries({ queryKey: ["financeiro-vr-tab"] });
      setToCancel(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao encerrar contrato"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center text-base font-semibold capitalize">
            {monthLabel}
          </div>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-3 hidden text-sm text-muted-foreground sm:block">
            <span className="font-semibold tabular-nums text-foreground">
              {BRL.format(totalComissao)}
            </span>{" "}
            em comissões
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Novo lançamento VR
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou CNPJ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <StatusFilterChips
          value={filtroStatus}
          onChange={setFiltroStatus}
          counts={counts}
          labels={{ pendentes: "Aguardando valor", pagos: "Com valor" }}
        />
      </div>


      {(vencidos.length > 0 || proximos.length > 0) && (
        <div className="grid gap-2">
          {vencidos.length > 0 && (
            <AlertBanner
              tone="danger"
              icon={<AlertTriangle className="h-4 w-4" />}
              text={`${vencidos.length} cliente${vencidos.length === 1 ? "" : "s"} com fidelidade VR vencida.`}
              firstClient={vencidos[0]}
            />
          )}
          {proximos.length > 0 && (
            <AlertBanner
              tone="warning"
              icon={<CalendarClock className="h-4 w-4" />}
              text={`${proximos.length} cliente${proximos.length === 1 ? "" : "s"} com fidelidade VR vencendo nos próximos 30 dias.`}
              firstClient={proximos[0]}
            />
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            month={monthLabel}
            onAdd={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento encontrado para "{search}".
            </p>
            <Button size="sm" variant="ghost" onClick={() => setSearch("")}>Limpar busca</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor base</TableHead>
                <TableHead className="text-right">% Com.</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Fidelidade</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((r) => {
                const tone = vencimentoTone(r.fidelidade_vencimento);
                const aguardandoValor = r.valor_base == null;
                const encerrado = !!r.observacoes?.toLowerCase().includes("contrato vr encerrado");
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.client_id ? (
                          <Link
                            to={`/clientes/${r.client_id}`}
                            className="text-primary hover:underline"
                          >
                            {r.cliente_nome}
                          </Link>
                        ) : (
                          r.cliente_nome
                        )}
                        {encerrado && (
                          <Badge className="border-transparent bg-destructive/15 text-destructive hover:bg-destructive/20">
                            Encerrado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{formatCnpj(r.cnpj) || "—"}</TableCell>
                    <TableCell>
                      {r.tipo === "primeira_carga" ? (
                        <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">
                          Primeira carga
                        </Badge>
                      ) : (
                        <Badge className="border-transparent bg-teal-500/15 text-teal-600 hover:bg-teal-500/20">
                          Recorrência
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {aguardandoValor ? (
                        <Badge className="border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/20">
                          Aguardando valor
                        </Badge>
                      ) : (
                        BRL.format(Number(r.valor_base))
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(r.percentual_comissao)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {aguardandoValor ? "—" : BRL.format(Number(r.valor_comissao))}
                    </TableCell>
                    <TableCell>
                      {r.fidelidade_meses ? `${r.fidelidade_meses} meses` : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm",
                          tone === "danger" && "text-destructive font-medium",
                          tone === "warning" && "text-amber-500 font-medium",
                          tone === "ok" && "text-emerald-500",
                        )}
                      >
                        {formatBRDate(r.fidelidade_vencimento)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {aguardandoValor && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Inserir valor"
                            onClick={() => setToFill(r)}
                            className="text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                          >
                            <Coins className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && r.tipo === "primeira_carga" && r.client_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Encerrar contrato VR"
                            onClick={() =>
                              setToCancel({
                                client_id: r.client_id!,
                                cliente_nome: r.cliente_nome,
                                primeira_carga_id: r.id,
                              })
                            }
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(r);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToDelete(r)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  {filtroStatus === "pendentes"
                    ? `Aguardando valor (${counts.pendentes})`
                    : filtroStatus === "pagos"
                      ? `Com valor (${counts.pagos})`
                      : `Total (${counts.todos})`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {BRL.format(totalBase)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {BRL.format(totalComissao)}
                </TableCell>
                <TableCell colSpan={3} className="text-xs text-muted-foreground">
                  {filtroStatus === "todos" && counts.pendentes > 0 && (
                    <span>
                      {counts.pendentes} aguardando valor · {counts.pagos} com valor (
                      {BRL.format(totalComissaoPagos)})
                    </span>
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>

          </Table>
        )}
      </Card>

      <LancamentoVrDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        defaultCompetencia={month}
        initial={editing}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento VR?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `Excluir este lançamento de ${toDelete.cliente_nome} referente a ${format(new Date(toDelete.competencia + "T00:00:00"), "MM/yyyy")}? Esta ação não pode ser desfeita.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) deleteMut.mutate(toDelete.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toCancel} onOpenChange={(v) => !v && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar contrato VR?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel ? (
                <>
                  Encerrar contrato VR de <strong>{toCancel.cliente_nome}</strong>?<br />
                  As recorrências pendentes futuras (sem valor preenchido) serão removidas.
                  Lançamentos já preenchidos serão mantidos no histórico.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (toCancel) cancelMut.mutate({ client_id: toCancel.client_id, primeira_carga_id: toCancel.primeira_carga_id });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PreencherValorRecorrenciaDialog
        open={!!toFill}
        onOpenChange={(v) => !v && setToFill(null)}
        lancamento={
          toFill
            ? {
                id: toFill.id,
                cliente_nome: toFill.cliente_nome,
                competencia: toFill.competencia,
                percentual_comissao: Number(toFill.percentual_comissao),
              }
            : null
        }
      />
    </div>
  );
}

function AlertBanner({
  tone,
  icon,
  text,
  firstClient,
}: {
  tone: "danger" | "warning";
  icon: React.ReactNode;
  text: string;
  firstClient: { client_id: string | null };
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border-l-4 p-3 text-sm",
        tone === "danger"
          ? "border-l-destructive bg-destructive/5 text-destructive"
          : "border-l-amber-500 bg-amber-500/5 text-amber-600",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{text}</span>
      </div>
      {firstClient.client_id && (
        <Button variant="link" size="sm" asChild className="h-auto p-0">
          <Link to={`/clientes/${firstClient.client_id}`}>Ver cliente</Link>
        </Button>
      )}
    </div>
  );
}

function EmptyState({ month, onAdd }: { month: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-sm text-muted-foreground">
        Nenhum lançamento VR em {month}. Clique em "+ Novo lançamento VR" para começar.
      </p>
      <Button size="sm" onClick={onAdd} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Novo lançamento VR
      </Button>
    </div>
  );
}
