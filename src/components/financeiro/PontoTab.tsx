import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { LancamentoPontoDialog, LancamentoPonto } from "./LancamentoPontoDialog";
import { BRL, formatBRDate, vencimentoTone, ymdFirst } from "./financeiroUtils";

const PADRAO_PERC = 40;
type Row = LancamentoPonto & { valor_nortear: number; fidelidade_vencimento: string | null };

export function PontoTab() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LancamentoPonto | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const competencia = ymdFirst(month);
  const monthLabel = format(month, "LLLL / yyyy", { locale: ptBR }).replace(
    /^./,
    (c) => c.toUpperCase(),
  );

  const { data = [], isLoading } = useQuery({
    queryKey: ["financeiro-ponto-tab", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_ponto")
        .select(
          "id, client_id, cliente_nome, cnpj, competencia, valor_mensalidade, percentual_nortear, valor_nortear, fidelidade_meses, fidelidade_inicio, fidelidade_vencimento, notificar_vencimento, observacoes",
        )
        .eq("competencia", competencia)
        .order("valor_nortear", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const totalMensalidade = useMemo(
    () => data.reduce((s, r) => s + Number(r.valor_mensalidade), 0),
    [data],
  );
  const totalNortear = useMemo(
    () => data.reduce((s, r) => s + Number(r.valor_nortear), 0),
    [data],
  );

  const vencidos = data.filter((r) => vencimentoTone(r.fidelidade_vencimento) === "danger");
  const proximos = data.filter((r) => vencimentoTone(r.fidelidade_vencimento) === "warning");

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lancamentos_ponto").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído.");
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      qc.invalidateQueries({ queryKey: ["financeiro-ponto-tab"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidade-alertas"] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center text-base font-semibold capitalize">
            {monthLabel}
          </div>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-3 hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <span>
              <span className="font-semibold tabular-nums text-foreground">
                {BRL.format(totalNortear)}
              </span>{" "}
              para a Nortear
            </span>
            <Badge variant="secondary" className="font-normal">
              % padrão: {PADRAO_PERC}%
            </Badge>
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
          Novo lançamento Ponto
        </Button>
      </div>

      {(vencidos.length > 0 || proximos.length > 0) && (
        <div className="grid gap-2">
          {vencidos.length > 0 && (
            <AlertBanner
              tone="danger"
              icon={<AlertTriangle className="h-4 w-4" />}
              text={`${vencidos.length} cliente${vencidos.length === 1 ? "" : "s"} com fidelidade Ponto vencida.`}
              firstClient={vencidos[0]}
            />
          )}
          {proximos.length > 0 && (
            <AlertBanner
              tone="warning"
              icon={<CalendarClock className="h-4 w-4" />}
              text={`${proximos.length} cliente${proximos.length === 1 ? "" : "s"} com fidelidade Ponto vencendo nos próximos 30 dias.`}
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
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead className="text-right">% Nortear</TableHead>
                <TableHead className="text-right">Valor Nortear</TableHead>
                <TableHead>Fidelidade</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const tone = vencimentoTone(r.fidelidade_vencimento);
                const perc = Number(r.percentual_nortear);
                const customPerc = perc !== PADRAO_PERC;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.cnpj ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {BRL.format(Number(r.valor_mensalidade))}
                    </TableCell>
                    <TableCell className="text-right">
                      {customPerc ? (
                        <Badge className="border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/20">
                          {perc.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="tabular-nums">{perc.toFixed(1)}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {BRL.format(Number(r.valor_nortear))}
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
                <TableCell colSpan={2} className="text-right font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {BRL.format(totalMensalidade)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {BRL.format(totalNortear)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>

      <LancamentoPontoDialog
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
            <AlertDialogTitle>Excluir lançamento Ponto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
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
        Nenhum lançamento Ponto em {month}. Clique em "+ Novo lançamento Ponto" para começar.
      </p>
      <Button size="sm" onClick={onAdd} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Novo lançamento Ponto
      </Button>
    </div>
  );
}
