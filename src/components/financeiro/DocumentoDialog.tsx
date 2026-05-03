import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

import { ClientCombobox, ClientOption } from "./ClientCombobox";
import { ymdFirst } from "./financeiroUtils";

type Tipo = "nota_fiscal" | "boleto" | "outro";
type Status = "pendente" | "pago";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompetencia: Date;
  defaultTipo?: Tipo;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function DocumentoDialog({
  open,
  onOpenChange,
  defaultCompetencia,
  defaultTipo = "boleto",
}: Props) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>(defaultTipo);
  const [competencia, setCompetencia] = useState<string>(ymdFirst(defaultCompetencia));
  const [client, setClient] = useState<ClientOption | null>(null);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("pendente");
  const [dataPagamento, setDataPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTipo(defaultTipo);
    setCompetencia(ymdFirst(defaultCompetencia));
    setClient(null);
    setDescricao("");
    setValor("");
    setFile(null);
    setStatus("pendente");
    setDataPagamento("");
    setObservacoes("");
  }, [open, defaultCompetencia, defaultTipo]);

  // Pré-preencher valor quando NF
  const { data: mrr } = useQuery({
    queryKey: ["mrr-mes", competencia],
    enabled: open && tipo === "nota_fiscal" && !!competencia,
    queryFn: async () => {
      const [vr, ponto] = await Promise.all([
        supabase.from("lancamentos_vr").select("valor_comissao").eq("competencia", competencia),
        supabase.from("parcelas_rh_digital").select("valor_nortear").eq("competencia", competencia),
      ]);
      const tot =
        (vr.data ?? []).reduce((s, r) => s + Number(r.valor_comissao || 0), 0) +
        (ponto.data ?? []).reduce((s, r) => s + Number(r.valor_nortear || 0), 0);
      return tot;
    },
  });
  useEffect(() => {
    if (tipo === "nota_fiscal" && mrr != null && !valor) {
      setValor(mrr.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrr, tipo]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo.");
      if (file.size > MAX_BYTES) throw new Error("Arquivo excede 10MB.");
      if (!descricao.trim()) throw new Error("Informe a descrição.");
      if (!valor) throw new Error("Informe o valor.");
      if (status === "pago" && !dataPagamento) throw new Error("Informe a data de pagamento.");

      const d = new Date(competencia + "T00:00:00");
      const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${Date.now()}-${file.name}`;
      const upload = await supabase.storage.from("documentos-financeiros").upload(path, file, {
        contentType: file.type,
      });
      if (upload.error) throw upload.error;

      const userRes = await supabase.auth.getUser();
      const { error } = await supabase.from("documentos_financeiros").insert({
        client_id: client?.id ?? null,
        cliente_nome: client?.name ?? null,
        competencia,
        tipo,
        descricao: descricao.trim(),
        valor: Number(valor),
        arquivo_url: path,
        arquivo_nome: file.name,
        status_pagamento: status,
        data_pagamento: status === "pago" ? dataPagamento : null,
        observacoes: observacoes.trim() || null,
        created_by: userRes.data.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento anexado com sucesso!");
      qc.invalidateQueries({ queryKey: ["financeiro-documentos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-docs-mes"] });
      qc.invalidateQueries({ queryKey: ["financeiro-docs-resumo-anual"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Anexar documento financeiro</DialogTitle>
          <DialogDescription>
            Nota fiscal, boleto ou outro documento. Arquivo máx. 10MB.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="comp-doc">Competência *</Label>
              <Input
                id="comp-doc"
                type="month"
                value={competencia.slice(0, 7)}
                onChange={(e) => setCompetencia(e.target.value ? `${e.target.value}-01` : "")}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Cliente (opcional)</Label>
            <ClientCombobox value={client?.id ?? null} onSelect={setClient} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="desc-doc">Descrição *</Label>
            <Input
              id="desc-doc"
              placeholder="Ex: NF-0042"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="val-doc">Valor (R$) *</Label>
              <Input
                id="val-doc"
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === "pago" && (
            <div className="grid gap-1.5">
              <Label htmlFor="dt-pag">Data de pagamento *</Label>
              <Input
                id="dt-pag"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="file-doc">Arquivo * (PDF, PNG, JPG — máx. 10MB)</Label>
            <Input
              id="file-doc"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Upload className="h-3 w-3" />
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="obs-doc">Observações</Label>
            <Textarea
              id="obs-doc"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
