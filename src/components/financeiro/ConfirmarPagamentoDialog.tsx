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

  useEffect(() => {
    if (open) {
      setDataPag(format(new Date(), "yyyy-MM-dd"));
      setObs("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parcela) throw new Error("Parcela inválida");
      const { error } = await supabase
        .from("parcelas_rh_digital")
        .update({
          status: "pago",
          data_pagamento: dataPag,
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
      <DialogContent className="sm:max-w-[440px]">
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
            <div className="text-xs text-muted-foreground">Valor Nortear</div>
            <div className="text-xl font-semibold tabular-nums">
              {parcela ? BRL.format(parcela.valor_nortear) : "—"}
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
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
