import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_FLOW, STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { CustomStage } from "@/components/TicketKanban";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  etapa: CustomStage | null;
  customStages: CustomStage[];
}

export function ExcluirEtapaDialog({ open, onOpenChange, etapa, customStages }: Props) {
  const qc = useQueryClient();
  const [destino, setDestino] = useState<string>("");

  const { data: total, isLoading: countLoading } = useQuery({
    queryKey: ["custom-stage-ticket-count", etapa?.stage_key],
    enabled: open && !!etapa,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("active_custom_stage_key", etapa!.stage_key);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (open && etapa) setDestino(`base:${etapa.base_status}`);
  }, [open, etapa]);

  const excluir = useMutation({
    mutationFn: async () => {
      if (!etapa) return;
      const qtd = total ?? 0;
      if (qtd > 0) {
        if (!destino) throw new Error("Selecione para onde mover os chamados");
        let targetStatus: TicketStatus;
        let targetCustom: string | null;
        if (destino.startsWith("base:")) {
          targetStatus = destino.slice(5) as TicketStatus;
          targetCustom = null;
        } else {
          const slug = destino.slice("custom:".length);
          const stage = customStages.find((c) => c.stage_key === slug);
          if (!stage) throw new Error("Etapa de destino inválida");
          targetStatus = stage.base_status;
          targetCustom = slug;
        }
        const { error: updErr } = await supabase
          .from("tickets")
          .update({ status: targetStatus, active_custom_stage_key: targetCustom } as any)
          .eq("active_custom_stage_key", etapa.stage_key);
        if (updErr) throw updErr;
      }
      const { error: delErr } = await supabase
        .from("custom_ticket_stages")
        .delete()
        .eq("id", etapa.id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(
        (total ?? 0) > 0
          ? `Etapa excluída. ${total} chamado(s) realocado(s).`
          : "Etapa excluída.",
      );
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  if (!etapa) return null;

  const qtd = total ?? 0;
  const hasTickets = qtd > 0;
  const outrasCustom = customStages.filter((c) => c.id !== etapa.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir etapa "{etapa.label}"?</DialogTitle>
          <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
        </DialogHeader>

        {countLoading ? (
          <p className="text-sm text-muted-foreground">Verificando chamados…</p>
        ) : hasTickets ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                Existem <strong>{qtd}</strong> chamado(s) nesta etapa. Escolha para onde movê-los antes de excluir.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Mover chamados para</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map((s) => (
                    <SelectItem key={`base:${s}`} value={`base:${s}`}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                  {outrasCustom.map((c) => (
                    <SelectItem key={`custom:${c.stage_key}`} value={`custom:${c.stage_key}`}>
                      {c.label} <span className="text-muted-foreground">(em {STATUS_LABEL[c.base_status]})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            A etapa "{etapa.label}" não tem chamados vinculados e pode ser excluída.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => excluir.mutate()}
            disabled={excluir.isPending || countLoading || (hasTickets && !destino)}
          >
            {excluir.isPending ? "Excluindo..." : hasTickets ? "Mover e excluir" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
