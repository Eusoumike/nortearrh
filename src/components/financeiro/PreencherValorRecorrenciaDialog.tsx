import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { BRL } from "./financeiroUtils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lancamento: {
    id: string;
    cliente_nome: string;
    competencia: string;
    percentual_comissao: number;
  } | null;
}

export function PreencherValorRecorrenciaDialog({ open, onOpenChange, lancamento }: Props) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("");

  const comissaoPreview = useMemo(() => {
    const v = Number(valor || 0);
    const p = Number(lancamento?.percentual_comissao || 0);
    return Math.round(v * (p / 100) * 100) / 100;
  }, [valor, lancamento]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!lancamento) throw new Error("Lançamento inválido");
      const v = Number(valor);
      if (!v || v <= 0) throw new Error("Informe um valor base maior que zero");
      const { error } = await supabase
        .from("lancamentos_vr")
        .update({ valor_base: v })
        .eq("id", lancamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valor preenchido com sucesso!");
      qc.invalidateQueries({ queryKey: ["financeiro-vr"] });
      qc.invalidateQueries({ queryKey: ["financeiro-vr-tab"] });
      setValor("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setValor("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Inserir valor base</DialogTitle>
          <DialogDescription>
            {lancamento?.cliente_nome} — competência {lancamento?.competencia.slice(0, 7)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="valor-base-recorrencia">Valor base (R$)</Label>
            <Input
              id="valor-base-recorrencia"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Comissão ({Number(lancamento?.percentual_comissao || 0).toFixed(2).replace(".", ",")}%):{" "}
            <span className="font-semibold tabular-nums">{BRL.format(comissaoPreview)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
