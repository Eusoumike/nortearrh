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
import { formatPercent } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";

export type ParcelaSummary = {
  id: string;
  cliente_nome: string;
  competencia: string;
  valor_mensalidade: number;
  percentual_nortear: number;
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
      setValorRecebidoStr(
        parcela ? String(Number(parcela.valor_mensalidade).toFixed(2)) : "",
      );
    }
  }, [open, parcela]);

  const valorMensalidade = parcela ? Number(parcela.valor_mensalidade) : 0;
  const valorNortear = parcela ? Number(parcela.valor_nortear) : 0;
  const percNortear =
    valorMensalidade > 0 ? valorNortear / valorMensalidade : 0;

  const valorRecebido = (() => {
    const n = Number(String(valorRecebidoStr).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
  const valorNortearRecebido = Number((valorRecebido * percNortear).toFixed(2));
  const diferenca = Number((valorRecebido - valorMensalidade).toFixed(2));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcela) throw new Error("Parcela inválida");
      const { error } = await supabase
        .from("parcelas_rh_digital")
        .update({
          status: "pago",
          data_pagamento: dataPag,
          valor_recebido: valorRecebido,
          valor_nortear_recebido: valorNortearRecebido,
          diferenca_valor: diferenca,
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

  const diffBlock = (() => {
    if (!parcela) return null;
    if (Math.abs(diferenca) < 0.005) {
      return (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-center">
          <div className="text-sm text-muted-foreground">Valor exato do contrato</div>
          <div className="mt-1 text-sm">
            Valor Nortear:{" "}
            <span className="font-semibold tabular-nums">{BRL.format(valorNortear)}</span>
          </div>
        </div>
      );
    }
    if (diferenca > 0) {
      return (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
          <div className="font-semibold text-emerald-600 tabular-nums">
            + {BRL.format(diferenca)} acima do contrato
          </div>
          <div className="text-xs text-muted-foreground">Cliente pagou com juros/multa</div>
          <div className="mt-2 text-sm">
            Valor Nortear ajustado:{" "}
            <span className="font-semibold tabular-nums text-emerald-600">
              {BRL.format(valorNortearRecebido)}
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-center">
        <div className="font-semibold text-destructive tabular-nums">
          − {BRL.format(Math.abs(diferenca))} abaixo do contrato
        </div>
        <div className="text-xs text-muted-foreground">Pagamento parcial ou com desconto</div>
        <div className="mt-2 text-sm">
          Valor Nortear ajustado:{" "}
          <span className="font-semibold tabular-nums text-destructive">
            {BRL.format(valorNortearRecebido)}
          </span>
        </div>
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
          <div className="rounded-md border bg-muted/40 px-4 py-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Referência do contrato
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor total:</span>
              <span className="font-semibold tabular-nums">
                {parcela ? BRL.format(valorMensalidade) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Valor Nortear ({parcela ? formatPercent(parcela.percentual_nortear) : "—"}):
              </span>
              <span className="font-semibold tabular-nums">
                {parcela ? BRL.format(valorNortear) : "—"}
              </span>
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
              placeholder={parcela ? valorMensalidade.toFixed(2) : "0,00"}
              value={valorRecebidoStr}
              onChange={(e) => setValorRecebidoStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valor total pago pelo cliente (não apenas a parte da Nortear).
            </p>
          </div>

          {diffBlock}

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
