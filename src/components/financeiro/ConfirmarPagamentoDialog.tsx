import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

import { BRL, formatBRDate } from "./financeiroUtils";
import { supabase } from "@/integrations/supabase/client";

export type ParcelaSummary = {
  id: string;
  cliente_nome: string;
  competencia: string;
  valor_nortear: number;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parcela: ParcelaSummary | null;
}

export function ConfirmarPagamentoDialog({ open, onOpenChange, parcela }: Props) {
  const qc = useQueryClient();
  const [dataPag, setDataPag] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [obs, setObs] = useState("");
  const [valorRecebidoStr, setValorRecebidoStr] = useState("");

  useEffect(() => {
    if (open) {
      setDataPag(format(new Date(), "yyyy-MM-dd"));
      setObs("");
      setValorRecebidoStr(parcela ? String(Number(parcela.valor_nortear).toFixed(2)) : "");
    }
  }, [open, parcela]);

  const valorContrato = parcela ? Number(parcela.valor_nortear) : 0;
  const valorRecebido = (() => {
    const n = Number(String(valorRecebidoStr).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
  const diferenca = valorRecebido - valorContrato;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcela) throw new Error("Parcela inválida");
      const { error } = await supabase
        .from("parcelas_rh_digital")
        .update({
          status: "pago",
          data_pagamento: dataPag,
          valor_recebido: valorRecebido,
          diferenca_valor: Number(diferenca.toFixed(2)),
          // mantém legado coerente para visualizações antigas
          acrescimos: diferenca > 0 ? Number(diferenca.toFixed(2)) : 0,
          valor_total_recebido: valorRecebido,
          observacoes: obs.trim() || null,
        })
        .eq("id", parcela.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento confirmado.");
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao confirmar pagamento"),
  });

  const diffBadge = (() => {
    if (!parcela) return null;
    if (Math.abs(diferenca) < 0.005) {
      return (
        <div className="rounded-md border bg-muted/40 px-4 py-2.5 text-center text-sm text-muted-foreground">
          Valor exato do contrato
        </div>
      );
    }
    if (diferenca > 0) {
      return (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center">
          <div className="font-semibold text-emerald-600 tabular-nums">
            + {BRL.format(diferenca)} acima do contrato
          </div>
          <div className="text-xs text-muted-foreground">Cliente pagou com juros/multa</div>
        </div>
      );
    }
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center">
        <div className="font-semibold text-destructive tabular-nums">
          − {BRL.format(Math.abs(diferenca))} abaixo do contrato
        </div>
        <div className="text-xs text-muted-foreground">Pagamento parcial ou com desconto</div>
      </div>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
          <DialogDescription>
            {parcela
              ? `${parcela.cliente_nome} — competência ${formatBRDate(parcela.competencia)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-center">
            <div className="text-xs text-muted-foreground">Valor do contrato</div>
            <div className="text-xl font-semibold tabular-nums">
              {parcela ? BRL.format(valorContrato) : "—"}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="valor-recebido">Valor recebido *</Label>
            <Input
              id="valor-recebido"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder={parcela ? Number(valorContrato).toFixed(2) : "0,00"}
              value={valorRecebidoStr}
              onChange={(e) => setValorRecebidoStr(e.target.value)}
            />
          </div>

          {diffBadge}

          <div className="grid gap-1.5">
            <Label htmlFor="data-pag">Data de pagamento *</Label>
            <Input
              id="data-pag"
              type="date"
              value={dataPag}
              onChange={(e) => setDataPag(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="obs-pag">Observações</Label>
            <Textarea id="obs-pag" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !parcela || !valorRecebidoStr}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
