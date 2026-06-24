import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { useEtapasKanban, type EtapaItem } from "@/hooks/useEtapasKanban";
import { CircleDot, Loader2, Clock, Headphones, FileText, CheckCircle2, PauseCircle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketStatusPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  ticketNumber?: string | null;
  ticketTitle?: string | null;
}

const BASE_ICON: Record<TicketStatus, React.ComponentType<any>> = {
  novo: CircleDot,
  em_atendimento: Clock,
  aguardando_cliente: PauseCircle,
  suporte_vera_n1: Headphones,
  abertura_chamado_n2: FileText,
  resolvido: CheckCircle2,
  fechado: CheckCircle2,
};

const BASE_TONE: Record<TicketStatus, string> = {
  novo: "text-blue-600 dark:text-blue-400",
  em_atendimento: "text-amber-600 dark:text-amber-400",
  aguardando_cliente: "text-muted-foreground",
  suporte_vera_n1: "text-purple-600 dark:text-purple-400",
  abertura_chamado_n2: "text-rose-600 dark:text-rose-400",
  resolvido: "text-emerald-600 dark:text-emerald-400",
  fechado: "text-emerald-600 dark:text-emerald-400",
};

const AUTO_CLOSE_SECONDS = 30;

export function TicketStatusPopup({ open, onOpenChange, ticketId, ticketNumber, ticketTitle }: TicketStatusPopupProps) {
  const qc = useQueryClient();
  const { items } = useEtapasKanban();
  const [updating, setUpdating] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(AUTO_CLOSE_SECONDS);
    const interval = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const timer = setTimeout(() => onOpenChange(false), AUTO_CLOSE_SECONDS * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [open, onOpenChange]);

  const handleSelect = async (etapa: EtapaItem) => {
    if (!ticketId || updating) return;
    if (etapa.kind === "base" && etapa.base === "novo") {
      onOpenChange(false);
      toast.success('Chamado criado como "Novo"!');
      return;
    }
    setUpdating(etapa.key);
    const { error } = await supabase
      .from("tickets")
      .update({ status: etapa.base, active_custom_stage_key: etapa.customKey } as any)
      .eq("id", ticketId);
    setUpdating(null);
    if (error) {
      toast.error(error.message || "Erro ao atualizar status.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
    qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    onOpenChange(false);
    toast.success(`Chamado movido para "${etapa.label}"!`);
  };

  // Esconde "fechado" no momento da criação (mantém comportamento anterior do popup).
  const visible = items.filter((e) => !(e.kind === "base" && e.base === "fechado"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 gap-3 animate-in fade-in zoom-in-95 duration-200">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Em qual etapa está este chamado?</DialogTitle>
          <DialogDescription className="text-xs">
            {ticketNumber && <span className="font-mono">#{ticketNumber}</span>}
            {ticketNumber && ticketTitle && " · "}
            {ticketTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
          {visible.map((etapa) => {
            const isUpdating = updating === etapa.key;
            const Icon = etapa.kind === "base" ? BASE_ICON[etapa.base] : Layers;
            const iconClass = etapa.kind === "base" ? BASE_TONE[etapa.base] : "";
            return (
              <button
                key={etapa.key}
                type="button"
                disabled={!!updating}
                onClick={() => handleSelect(etapa)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm font-medium",
                  "hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer text-left",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : etapa.kind === "custom" ? (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: etapa.color ?? "#6B7280" }}
                  />
                ) : (
                  <Icon className={cn("h-4 w-4 shrink-0", iconClass)} />
                )}
                <span className="truncate">
                  {etapa.label}
                  {etapa.kind === "custom" && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({STATUS_LABEL[etapa.base]})
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Manter etapa atual e fechar
          </button>
          <span className="text-[10px] text-muted-foreground/70">
            Fechando em {secondsLeft}s…
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
