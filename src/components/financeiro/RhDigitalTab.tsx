import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
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
import { ContratoRhDialog, ContratoRh } from "./ContratoRhDialog";
import { ConfirmarPagamentoDialog, ParcelaSummary } from "./ConfirmarPagamentoDialog";
import { BRL, formatBRDate, vencimentoTone, ymdFirst } from "./financeiroUtils";

const PADRAO_PERC = 40;

type Parcela = {
  id: string;
  contrato_id: string;
  client_id: string | null;
  cliente_nome: string;
  competencia: string;
  valor_mensalidade: number;
  percentual_nortear: number;
  valor_nortear: number;
  status: "pendente" | "pago" | "inadimplente";
  data_pagamento: string | null;
};

type Contrato = {
  id: string;
  client_id: string | null;
  cliente_nome: string;
  cnpj: string | null;
  valor_mensalidade: number;
  percentual_nortear: number;
  valor_nortear: number;
  data_inicio: string;
  fidelidade_meses: number;
  fidelidade_vencimento: string | null;
  notificar_vencimento: boolean;
  ativo: boolean;
  observacoes: string | null;
};

export function RhDigitalTab() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<"parcelas" | "contratos">("parcelas");
  const [contratoDialog, setContratoDialog] = useState(false);
  const [editingContrato, setEditingContrato] = useState<ContratoRh | null>(null);
  const [pagandoParcela, setPagandoParcela] = useState<ParcelaSummary | null>(null);
  const [marcarInad, setMarcarInad] = useState<Parcela | null>(null);
  const [encerrarContrato, setEncerrarContrato] = useState<Contrato | null>(null);
  const [excluirParcela, setExcluirParcela] = useState<Parcela | null>(null);
  const [excluirContrato, setExcluirContrato] = useState<Contrato | null>(null);

  const competencia = ymdFirst(month);
  const monthLabel = format(month, "LLLL / yyyy", { locale: ptBR }).replace(
    /^./,
    (c) => c.toUpperCase(),
  );

  const parcelasQuery = useQuery({
    queryKey: ["financeiro-rh-parcelas", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select(
          "id, contrato_id, client_id, cliente_nome, competencia, valor_mensalidade, percentual_nortear, valor_nortear, status, data_pagamento",
        )
        .eq("competencia", competencia)
        .order("valor_nortear", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Parcela[];
    },
  });

  const contratosQuery = useQuery({
    queryKey: ["financeiro-rh-contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_rh_digital")
        .select(
          "id, client_id, cliente_nome, cnpj, valor_mensalidade, percentual_nortear, valor_nortear, data_inicio, fidelidade_meses, fidelidade_vencimento, notificar_vencimento, ativo, observacoes",
        )
        .order("ativo", { ascending: false })
        .order("cliente_nome");
      if (error) throw error;
      return (data ?? []) as Contrato[];
    },
  });

  const parcelas = parcelasQuery.data ?? [];
  const contratos = contratosQuery.data ?? [];
  const contratosAtivos = contratos.filter((c) => c.ativo);

  // Stats agregadas para parcelas pagas/contratadas
  const statsParcelasContrato = useMemo(() => {
    const map = new Map<string, { pagas: number; total: number }>();
    contratos.forEach((c) => map.set(c.id, { pagas: 0, total: c.fidelidade_meses }));
    return map;
  }, [contratos]);

  // Buscar contagem de parcelas pagas por contrato (lazy via segunda query)
  const pagasQuery = useQuery({
    queryKey: ["financeiro-rh-parcelas-pagas-contagem"],
    enabled: view === "contratos" && contratos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_rh_digital")
        .select("contrato_id, status");
      if (error) throw error;
      const counts = new Map<string, number>();
      (data ?? []).forEach((p: any) => {
        if (p.status === "pago") counts.set(p.contrato_id, (counts.get(p.contrato_id) ?? 0) + 1);
      });
      return counts;
    },
  });

  const totalMensalidade = parcelas.reduce((s, p) => s + Number(p.valor_mensalidade), 0);
  const totalNortear = parcelas.reduce((s, p) => s + Number(p.valor_nortear), 0);
  const qtdPagos = parcelas.filter((p) => p.status === "pago").length;
  const qtdPendentes = parcelas.filter((p) => p.status === "pendente").length;

  // Banners de fidelidade (entre contratos ativos)
  const vencidos = contratosAtivos.filter(
    (c) => vencimentoTone(c.fidelidade_vencimento) === "danger",
  );
  const proximos = contratosAtivos.filter(
    (c) => vencimentoTone(c.fidelidade_vencimento) === "warning",
  );

  const marcarInadMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("parcelas_rh_digital")
        .update({ status: "inadimplente" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela marcada como inadimplente.");
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      setMarcarInad(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const encerrarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contratos_rh_digital")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato encerrado. Parcelas futuras pendentes foram removidas.");
      qc.invalidateQueries({ queryKey: ["financeiro-rh-contratos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidade-alertas"] });
      setEncerrarContrato(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const excluirParcelaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parcelas_rh_digital").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela excluída com sucesso");
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas-pagas-contagem"] });
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      setExcluirParcela(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const excluirContratoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase
        .from("parcelas_rh_digital")
        .delete()
        .eq("contrato_id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("contratos_rh_digital").delete().eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Contrato excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["financeiro-rh-contratos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas-pagas-contagem"] });
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidade-alertas"] });
      setExcluirContrato(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const openNovoContrato = () => {
    setEditingContrato(null);
    setContratoDialog(true);
  };

  const openEditarContrato = (c: Contrato) => {
    setEditingContrato({
      id: c.id,
      client_id: c.client_id,
      cliente_nome: c.cliente_nome,
      cnpj: c.cnpj,
      valor_mensalidade: c.valor_mensalidade,
      percentual_nortear: c.percentual_nortear,
      data_inicio: c.data_inicio,
      fidelidade_meses: c.fidelidade_meses,
      notificar_vencimento: c.notificar_vencimento,
      observacoes: c.observacoes,
    });
    setContratoDialog(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
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
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              size="sm"
              variant={view === "parcelas" ? "secondary" : "ghost"}
              onClick={() => setView("parcelas")}
            >
              Parcelas do mês
            </Button>
            <Button
              size="sm"
              variant={view === "contratos" ? "secondary" : "ghost"}
              onClick={() => setView("contratos")}
            >
              Contratos ativos
            </Button>
          </div>
          <Button onClick={openNovoContrato} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo contrato
          </Button>
        </div>
      </div>

      {/* Banners */}
      {(vencidos.length > 0 || proximos.length > 0) && (
        <div className="grid gap-2">
          {vencidos.length > 0 && (
            <AlertBanner
              tone="danger"
              icon={<AlertTriangle className="h-4 w-4" />}
              text={`${vencidos.length} contrato${vencidos.length === 1 ? "" : "s"} com fidelidade vencida.`}
              onAction={openNovoContrato}
              actionLabel="Renovar"
            />
          )}
          {proximos.length > 0 && (
            <AlertBanner
              tone="warning"
              icon={<CalendarClock className="h-4 w-4" />}
              text={`${proximos.length} contrato${proximos.length === 1 ? "" : "s"} com fidelidade vencendo nos próximos 30 dias.`}
              onAction={openNovoContrato}
              actionLabel="Renovar"
            />
          )}
        </div>
      )}

      {/* View: Parcelas */}
      {view === "parcelas" && (
        <Card className="overflow-hidden">
          {parcelasQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : parcelas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma parcela em {monthLabel}. Crie um contrato para gerar parcelas mensais.
              </p>
              <Button size="sm" onClick={openNovoContrato} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo contrato
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Mensalidade</TableHead>
                  <TableHead className="text-right">% Nortear</TableHead>
                  <TableHead className="text-right">Valor Nortear</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="w-[160px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.map((p) => {
                  const customPerc = Number(p.percentual_nortear) !== PADRAO_PERC;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.client_id ? (
                          <Link
                            to={`/clientes/${p.client_id}`}
                            className="text-primary hover:underline"
                          >
                            {p.cliente_nome}
                          </Link>
                        ) : (
                          p.cliente_nome
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {BRL.format(Number(p.valor_mensalidade))}
                      </TableCell>
                      <TableCell className="text-right">
                        {customPerc ? (
                          <Badge className="border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/20">
                            {Number(p.percentual_nortear).toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="tabular-nums">
                            {Number(p.percentual_nortear).toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {BRL.format(Number(p.valor_nortear))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.data_pagamento ? formatBRDate(p.data_pagamento) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.status === "pendente" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Confirmar pagamento"
                                onClick={() =>
                                  setPagandoParcela({
                                    id: p.id,
                                    cliente_nome: p.cliente_nome,
                                    competencia: p.competencia,
                                    valor_nortear: Number(p.valor_nortear),
                                  })
                                }
                                className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Marcar inadimplente"
                                onClick={() => setMarcarInad(p)}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar contrato"
                            onClick={() => {
                              const c = contratos.find((x) => x.id === p.contrato_id);
                              if (c) openEditarContrato(c);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Excluir parcela"
                            onClick={() => setExcluirParcela(p)}
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
                  <TableCell className="text-right font-medium">Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {BRL.format(totalMensalidade)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {BRL.format(totalNortear)}
                  </TableCell>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    {qtdPagos} pago{qtdPagos === 1 ? "" : "s"} · {qtdPendentes} pendente
                    {qtdPendentes === 1 ? "" : "s"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </Card>
      )}

      {/* View: Contratos */}
      {view === "contratos" && (
        <Card className="overflow-hidden">
          {contratosQuery.isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : contratos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>
              <Button size="sm" onClick={openNovoContrato} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo contrato
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Mensalidade</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Valor Nortear</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fidelidade</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => {
                  const tone = vencimentoTone(c.fidelidade_vencimento);
                  const pagas = pagasQuery.data?.get(c.id) ?? 0;
                  return (
                    <TableRow key={c.id} className={cn(!c.ativo && "opacity-60")}>
                      <TableCell className="font-medium">
                        {c.client_id ? (
                          <Link
                            to={`/clientes/${c.client_id}`}
                            className="text-primary hover:underline"
                          >
                            {c.cliente_nome}
                          </Link>
                        ) : (
                          c.cliente_nome
                        )}
                        {!c.ativo && (
                          <Badge variant="outline" className="ml-2">
                            Encerrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {BRL.format(Number(c.valor_mensalidade))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(c.percentual_nortear).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {BRL.format(Number(c.valor_nortear))}
                      </TableCell>
                      <TableCell className="text-sm">{formatBRDate(c.data_inicio)}</TableCell>
                      <TableCell>{c.fidelidade_meses} meses</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-sm",
                            tone === "danger" && "text-destructive font-medium",
                            tone === "warning" && "text-amber-500 font-medium",
                            tone === "ok" && "text-emerald-600",
                          )}
                        >
                          {formatBRDate(c.fidelidade_vencimento)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {pagas}/{c.fidelidade_meses}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            onClick={() => openEditarContrato(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {c.ativo && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Encerrar contrato"
                              onClick={() => setEncerrarContrato(c)}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {(pagasQuery.data?.get(c.id) ?? 0) === 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Excluir contrato"
                              onClick={() => setExcluirContrato(c)}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Dialogs */}
      <ContratoRhDialog
        open={contratoDialog}
        onOpenChange={(v) => {
          setContratoDialog(v);
          if (!v) setEditingContrato(null);
        }}
        initial={editingContrato}
      />

      <ConfirmarPagamentoDialog
        open={!!pagandoParcela}
        onOpenChange={(v) => !v && setPagandoParcela(null)}
        parcela={pagandoParcela}
      />

      <AlertDialog open={!!marcarInad} onOpenChange={(v) => !v && setMarcarInad(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar parcela como inadimplente?</AlertDialogTitle>
            <AlertDialogDescription>
              {marcarInad &&
                `${marcarInad.cliente_nome} — competência ${formatBRDate(marcarInad.competencia)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (marcarInad) marcarInadMut.mutate(marcarInad.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Marcar inadimplente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!encerrarContrato} onOpenChange={(v) => !v && setEncerrarContrato(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              {encerrarContrato &&
                `Encerrar o contrato de ${encerrarContrato.cliente_nome}? As parcelas futuras pendentes serão removidas. Parcelas pagas serão mantidas no histórico.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (encerrarContrato) encerrarMut.mutate(encerrarContrato.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Encerrar contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }: { status: "pendente" | "pago" | "inadimplente" }) {
  if (status === "pago") {
    return (
      <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">
        Pago
      </Badge>
    );
  }
  if (status === "inadimplente") {
    return (
      <Badge className="border-transparent bg-destructive/15 text-destructive hover:bg-destructive/20">
        Inadimplente
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/20">
      Pendente
    </Badge>
  );
}

function AlertBanner({
  tone,
  icon,
  text,
  onAction,
  actionLabel,
}: {
  tone: "danger" | "warning";
  icon: React.ReactNode;
  text: string;
  onAction?: () => void;
  actionLabel?: string;
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
      {onAction && (
        <Button variant="link" size="sm" onClick={onAction} className="h-auto p-0">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
