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
  percentual_cross_selling?: number;
  valor_cross_selling?: number;
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
  const [percNortearStr, setPercNortearStr] = useState("");
  const [percCrossStr, setPercCrossStr] = useState("");

  useEffect(() => {
    if (open) {
      setDataPag(format(new Date(), "yyyy-MM-dd"));
      setObs("");
      setValorRecebidoStr(
        parcela ? String(Number(parcela.valor_mensalidade).toFixed(2)) : "",
      );
      setPercNortearStr(parcela ? String(Number(parcela.percentual_nortear ?? 0)) : "0");
      setPercCrossStr(
        parcela ? String(Number(parcela.percentual_cross_selling ?? 0)) : "0",
      );
    }
  }, [open, parcela]);

  const valorMensalidade = parcela ? Number(parcela.valor_mensalidade) : 0;

  const percNortearPct = (() => {
    const n = Number(String(percNortearStr).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
  const percCrossPct = (() => {
    const n = Number(String(percCrossStr).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();
  const percNortear = percNortearPct / 100;
  const percCross = percCrossPct / 100;

  const valorRecebido = (() => {
    const n = Number(String(valorRecebidoStr).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })();

  const valorNortearContrato = Number((valorMensalidade * percNortear).toFixed(2));
  const valorCrossContrato = Number((valorMensalidade * percCross).toFixed(2));
  const totalContrato = Number((valorNortearContrato + valorCrossContrato).toFixed(2));

  const valorNortearRecebido = Number((valorRecebido * percNortear).toFixed(2));
  const valorCrossRecebido = Number((valorRecebido * percCross).toFixed(2));
  const totalRecebido = Number((valorNortearRecebido + valorCrossRecebido).toFixed(2));

  const diferenca = Number((valorRecebido - valorMensalidade).toFixed(2));
  const temCross = percCrossPct > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcela) throw new Error("Parcela inválida");
      const { error } = await supabase
        .from("parcelas_rh_digital")
        .update({
          status: "pago",
          data_pagamento: dataPag,
          valor_recebido: valorRecebido,
          percentual_nortear: percNortearPct,
          percentual_cross_selling: percCrossPct,
          valor_nortear: valorNortearContrato,
          valor_cross_selling: valorCrossContrato,
          valor_nortear_recebido: valorNortearRecebido,
          valor_cross_selling_recebido: valorCrossRecebido,
          diferenca_valor: diferenca,
          observacoes: obs.trim() || null,
        } as any)
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
    const isExact = Math.abs(diferenca) < 0.005;
    const wrapperClass = isExact
      ? "rounded-md border bg-muted/40 px-4 py-3"
      : diferenca > 0
        ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
        : "rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3";
    const header = isExact ? (
      <div className="text-sm font-medium text-muted-foreground">
        ✓ Valor exato do contrato
      </div>
    ) : diferenca > 0 ? (
      <div className="text-sm font-semibold text-emerald-600 tabular-nums">
        🟢 + {BRL.format(diferenca)} acima do contrato
      </div>
    ) : (
      <div className="text-sm font-semibold text-destructive tabular-nums">
        🔴 − {BRL.format(Math.abs(diferenca))} abaixo do contrato
      </div>
    );
    return (
      <div className={wrapperClass}>
        {header}
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor Nortear:</span>
            <span className="font-semibold tabular-nums">
              {BRL.format(valorNortearRecebido)}
            </span>
          </div>
          {temCross && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cross Selling:</span>
              <span className="font-semibold tabular-nums">
                {BRL.format(valorCrossRecebido)}
              </span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t pt-1">
            <span className="font-medium">Total a receber:</span>
            <span className="font-bold tabular-nums text-primary">
              {BRL.format(totalRecebido)}
            </span>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
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
                Valor Nortear ({formatPercent(percNortearPct)}):
              </span>
              <span className="font-semibold tabular-nums">
                {BRL.format(valorNortearContrato)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Valor Cross Selling ({formatPercent(percCrossPct)}):
              </span>
              <span
                className={
                  temCross
                    ? "font-semibold tabular-nums text-emerald-600"
                    : "font-semibold tabular-nums text-muted-foreground"
                }
              >
                {BRL.format(valorCrossContrato)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t pt-1 text-sm">
              <span className="font-medium">TOTAL Nortear:</span>
              <span className="font-bold tabular-nums text-primary">
                {BRL.format(totalContrato)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="perc-nortear">% Nortear</Label>
              <Input
                id="perc-nortear"
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={percNortearStr}
                onChange={(e) => setPercNortearStr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Pré-preenchido com o % do contrato</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="perc-cross">% Cross Selling</Label>
              <Input
                id="perc-cross"
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={percCrossStr}
                onChange={(e) => setPercCrossStr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Adicione % de cross selling se aplicável</p>
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

          <p className="text-xs italic text-muted-foreground">
            💡 Alterações de % aqui valem apenas para esta parcela. Para alterar o contrato, use Editar contrato.
          </p>
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
