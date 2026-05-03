import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import { DocumentoDialog } from "./DocumentoDialog";
import { BRL, formatBRDate, ymdFirst } from "./financeiroUtils";

type Doc = {
  id: string;
  client_id: string | null;
  cliente_nome: string | null;
  competencia: string;
  tipo: "nota_fiscal" | "boleto" | "outro";
  descricao: string | null;
  valor: number | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  status_pagamento: "pendente" | "pago";
  data_pagamento: string | null;
};

interface Props {
  openUploadOnMount?: boolean;
  onConsumeOpenUpload?: () => void;
}

export function DocumentosTab({ openUploadOnMount, onConsumeOpenUpload }: Props) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTipo, setUploadTipo] = useState<"nota_fiscal" | "boleto" | "outro">("boleto");
  const [marcarPago, setMarcarPago] = useState<Doc | null>(null);
  const [pagDate, setPagDate] = useState("");
  const [excluir, setExcluir] = useState<Doc | null>(null);

  useEffect(() => {
    if (openUploadOnMount) {
      setUploadTipo("boleto");
      setUploadOpen(true);
      onConsumeOpenUpload?.();
    }
  }, [openUploadOnMount, onConsumeOpenUpload]);

  const competencia = ymdFirst(month);
  const monthLabel = format(month, "LLLL / yyyy", { locale: ptBR }).replace(
    /^./,
    (c) => c.toUpperCase(),
  );

  const docsQuery = useQuery({
    queryKey: ["financeiro-documentos", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_financeiros")
        .select(
          "id, client_id, cliente_nome, competencia, tipo, descricao, valor, arquivo_url, arquivo_nome, status_pagamento, data_pagamento",
        )
        .eq("competencia", competencia)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });

  const docs = docsQuery.data ?? [];
  const nfDoMes = docs.find((d) => d.tipo === "nota_fiscal");
  const outros = docs.filter((d) => d.tipo !== "nota_fiscal");

  // Resumo anual
  const ano = month.getFullYear();
  const resumoQuery = useQuery({
    queryKey: ["financeiro-docs-resumo-anual", ano],
    queryFn: async () => {
      const start = `${ano}-01-01`;
      const end = `${ano}-12-31`;
      const [vr, ponto, allDocs] = await Promise.all([
        supabase.from("lancamentos_vr").select("competencia, valor_comissao").gte("competencia", start).lte("competencia", end),
        supabase.from("parcelas_rh_digital").select("competencia, valor_nortear").gte("competencia", start).lte("competencia", end),
        supabase.from("documentos_financeiros").select("competencia, tipo, status_pagamento").gte("competencia", start).lte("competencia", end),
      ]);
      const meses = Array.from({ length: 12 }).map((_, i) => ({
        mes: i,
        vr: 0,
        ponto: 0,
        docs: 0,
        nfStatus: "sem" as "sem" | "pendente" | "pago",
      }));
      (vr.data ?? []).forEach((r: any) => {
        const m = new Date(r.competencia + "T00:00:00").getMonth();
        meses[m].vr += Number(r.valor_comissao || 0);
      });
      (ponto.data ?? []).forEach((r: any) => {
        const m = new Date(r.competencia + "T00:00:00").getMonth();
        meses[m].ponto += Number(r.valor_nortear || 0);
      });
      (allDocs.data ?? []).forEach((r: any) => {
        const m = new Date(r.competencia + "T00:00:00").getMonth();
        meses[m].docs += 1;
        if (r.tipo === "nota_fiscal") {
          meses[m].nfStatus = r.status_pagamento === "pago" ? "pago" : "pendente";
        }
      });
      return meses;
    },
  });

  const resumo = resumoQuery.data ?? [];
  const totalAnoVR = resumo.reduce((s, r) => s + r.vr, 0);
  const totalAnoPonto = resumo.reduce((s, r) => s + r.ponto, 0);

  const downloadDoc = async (doc: Doc) => {
    if (!doc.arquivo_url) return;
    const { data, error } = await supabase.storage
      .from("documentos-financeiros")
      .createSignedUrl(doc.arquivo_url, 60);
    if (error) {
      toast.error("Erro ao gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const marcarPagoMut = useMutation({
    mutationFn: async ({ id, dt }: { id: string; dt: string }) => {
      const { error } = await supabase
        .from("documentos_financeiros")
        .update({ status_pagamento: "pago", data_pagamento: dt })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento marcado como pago");
      qc.invalidateQueries({ queryKey: ["financeiro-documentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-docs-resumo-anual"] });
      setMarcarPago(null);
      setPagDate("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const excluirMut = useMutation({
    mutationFn: async (doc: Doc) => {
      if (doc.arquivo_url) {
        await supabase.storage.from("documentos-financeiros").remove([doc.arquivo_url]);
      }
      const { error } = await supabase.from("documentos_financeiros").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído");
      qc.invalidateQueries({ queryKey: ["financeiro-documentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-docs-resumo-anual"] });
      setExcluir(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
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
        </div>
        <Button onClick={() => { setUploadTipo("boleto"); setUploadOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Anexar documento
        </Button>
      </div>

      {/* NF do mês */}
      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Nota Fiscal do mês</h2>
        {docsQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !nfDoMes ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma NF anexada para {monthLabel}
            </p>
            <Button size="sm" onClick={() => { setUploadTipo("nota_fiscal"); setUploadOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Anexar nota fiscal
            </Button>
          </div>
        ) : (
          <DocLine
            doc={nfDoMes}
            onDownload={downloadDoc}
            onMarcarPago={(d) => { setMarcarPago(d); setPagDate(format(new Date(), "yyyy-MM-dd")); }}
            onExcluir={(d) => setExcluir(d)}
          />
        )}
      </Card>

      {/* Boletos e outros */}
      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Boletos e outros documentos</h2>
        {outros.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum outro documento em {monthLabel}.
          </p>
        ) : (
          <div className="grid gap-2">
            {outros.map((d) => (
              <DocLine
                key={d.id}
                doc={d}
                onDownload={downloadDoc}
                onMarcarPago={(doc) => { setMarcarPago(doc); setPagDate(format(new Date(), "yyyy-MM-dd")); }}
                onExcluir={(doc) => setExcluir(doc)}
              />
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => { setUploadTipo("boleto"); setUploadOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Anexar boleto/documento
          </Button>
        </div>
      </Card>

      {/* Resumo anual */}
      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Resumo anual {ano}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">MRR VR</TableHead>
              <TableHead className="text-right">MRR Ponto</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Documentos</TableHead>
              <TableHead>Status NF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumo.map((r) => {
              const total = r.vr + r.ponto;
              return (
                <TableRow key={r.mes}>
                  <TableCell className="capitalize">
                    {format(new Date(ano, r.mes, 1), "LLL", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{BRL.format(r.vr)}</TableCell>
                  <TableCell className="text-right tabular-nums">{BRL.format(r.ponto)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{BRL.format(total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.docs}</TableCell>
                  <TableCell><NfBadge status={r.nfStatus} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total {ano}</TableCell>
              <TableCell className="text-right tabular-nums">{BRL.format(totalAnoVR)}</TableCell>
              <TableCell className="text-right tabular-nums">{BRL.format(totalAnoPonto)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{BRL.format(totalAnoVR + totalAnoPonto)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <DocumentoDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultCompetencia={month}
        defaultTipo={uploadTipo}
      />

      {/* Modal marcar como pago */}
      <Dialog open={!!marcarPago} onOpenChange={(v) => !v && setMarcarPago(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="dt-pag-quick">Data de pagamento</Label>
            <Input
              id="dt-pag-quick"
              type="date"
              value={pagDate}
              onChange={(e) => setPagDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMarcarPago(null)}>Cancelar</Button>
            <Button
              onClick={() => marcarPago && pagDate && marcarPagoMut.mutate({ id: marcarPago.id, dt: pagDate })}
              disabled={!pagDate || marcarPagoMut.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir ? `Excluir "${excluir.descricao ?? excluir.arquivo_nome}"? Esta ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (excluir) excluirMut.mutate(excluir); }}
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

function DocLine({
  doc,
  onDownload,
  onMarcarPago,
  onExcluir,
}: {
  doc: Doc;
  onDownload: (d: Doc) => void;
  onMarcarPago: (d: Doc) => void;
  onExcluir: (d: Doc) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <div className="font-medium">
            {doc.descricao ?? doc.arquivo_nome}
            {doc.client_id && doc.cliente_nome && (
              <>
                {" · "}
                <Link to={`/clientes/${doc.client_id}`} className="text-primary hover:underline">
                  {doc.cliente_nome}
                </Link>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {doc.arquivo_nome}
            {doc.data_pagamento && ` · pago em ${formatBRDate(doc.data_pagamento)}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {doc.valor != null && (
          <span className="font-semibold tabular-nums">{BRL.format(Number(doc.valor))}</span>
        )}
        <StatusPagBadge status={doc.status_pagamento} />
        <Button size="icon" variant="ghost" title="Download" onClick={() => onDownload(doc)}>
          <Download className="h-4 w-4" />
        </Button>
        {doc.status_pagamento === "pendente" && (
          <Button size="sm" variant="outline" onClick={() => onMarcarPago(doc)}>
            Marcar como pago
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onExcluir(doc)}
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StatusPagBadge({ status }: { status: "pendente" | "pago" }) {
  return (
    <Badge
      className={cn(
        "border-transparent",
        status === "pago"
          ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20"
          : "bg-amber-500/15 text-amber-600 hover:bg-amber-500/20",
      )}
    >
      {status === "pago" ? "Pago" : "Pendente"}
    </Badge>
  );
}

function NfBadge({ status }: { status: "sem" | "pendente" | "pago" }) {
  if (status === "sem") return <Badge variant="secondary">Sem NF</Badge>;
  if (status === "pago")
    return <Badge className="border-transparent bg-emerald-500/15 text-emerald-600">Pago</Badge>;
  return <Badge className="border-transparent bg-amber-500/15 text-amber-600">Pendente</Badge>;
}
