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
  const [acrescimosStr, setAcrescimosStr] = useState("");

  useEffect(() => {
    if (open) {
      setDataPag(format(new Date(), "yyyy-MM-dd"));
      setObs("");
      setAcrescimosStr("");
    }
  }, [open]);

  const acrescimos = (() => {
    const n = Number(String(acrescimosStr).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const valorBase = parcela ? Number(parcela.valor_nortear) : 0;
  const totalRecebido = valorBase + acrescimos;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcela) throw new Error("Parcela inválida");
      const { error } = await supabase
        .from("parcelas_rh_digital")
        .update({
          status: "pago",
          data_pagamento: dataPag,
          acrescimos,
          valor_total_recebido: totalRecebido,
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
            <div className="text-xs text-muted-foreground">Valor da mensalidade</div>
            <div className="text-xl font-semibold tabular-nums">
              {parcela ? BRL.format(valorBase) : "—"}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="acrescimos">Acréscimos (juros/multa)</Label>
            <Input
              id="acrescimos"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0,00"
              value={acrescimosStr}
              onChange={(e) => setAcrescimosStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valor adicional cobrado por atraso
            </p>
          </div>

          <div
            className={cn(
              "rounded-md border px-4 py-3 text-center transition-colors",
              acrescimos > 0
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "bg-muted/40",
            )}
          >
            <div className="text-xs text-muted-foreground">Total recebido</div>
            <div
              className={cn(
                "text-xl font-semibold tabular-nums",
                acrescimos > 0 && "text-emerald-600",
              )}
            >
              = {BRL.format(totalRecebido)}
            </div>
          </div>

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
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !parcela}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
