import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STATUS_FLOW, STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { CircleDot, Loader2, Clock, Headphones, FileText, CheckCircle2, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketStatusPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  ticketNumber?: string | null;
  ticketTitle?: string | null;
}

const STATUS_META: Record<TicketStatus, { icon: React.ComponentType<any>; classes: string }> = {
  novo: { icon: CircleDot, classes: "text-blue-600 dark:text-blue-400" },
  em_atendimento: { icon: Clock, classes: "text-amber-600 dark:text-amber-400" },
  aguardando_cliente: { icon: PauseCircle, classes: "text-muted-foreground" },
  suporte_vera_n1: { icon: Headphones, classes: "text-purple-600 dark:text-purple-400" },
  abertura_chamado_n2: { icon: FileText, classes: "text-rose-600 dark:text-rose-400" },
  resolvido: { icon: CheckCircle2, classes: "text-emerald-600 dark:text-emerald-400" },
  fechado: { icon: CheckCircle2, classes: "text-emerald-600 dark:text-emerald-400" },
};

const AUTO_CLOSE_SECONDS = 30;

export function TicketStatusPopup({ open, onOpenChange, ticketId, ticketNumber, ticketTitle }: TicketStatusPopupProps) {
  const qc = useQueryClient();
  const [updating, setUpdating] = useState<TicketStatus | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(AUTO_CLOSE_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    const timer = setTimeout(() => {
      onOpenChange(false);
    }, AUTO_CLOSE_SECONDS * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [open, onOpenChange]);

  const handleSelect = async (status: TicketStatus) => {
    if (!ticketId || updating) return;
    if (status === "novo") {
      onOpenChange(false);
      toast.success('Chamado criado como "Novo"!');
      return;
    }
    setUpdating(status);
    const { error } = await supabase.from("tickets").update({ status }).eq("id", ticketId);
    setUpdating(null);
    if (error) {
      toast.error(error.message || "Erro ao atualizar status.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
    qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    onOpenChange(false);
    toast.success(`Chamado movido para "${STATUS_LABEL[status]}"!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 gap-3 animate-in fade-in zoom-in-95 duration-200">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Em qual status está este chamado?</DialogTitle>
          <DialogDescription className="text-xs">
            {ticketNumber && <span className="font-mono">#{ticketNumber}</span>}
            {ticketNumber && ticketTitle && " · "}
            {ticketTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {STATUS_FLOW.map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            const isUpdating = updating === s;
            return (
              <button
                key={s}
                type="button"
                disabled={!!updating}
                onClick={() => handleSelect(s)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm font-medium",
                  "hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer text-left",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Icon className={cn("h-4 w-4 shrink-0", meta.classes)} />
                )}
                <span className="truncate">{STATUS_LABEL[s]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => handleSelect("novo")}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Manter como "Novo" e fechar
          </button>
          <span className="text-[10px] text-muted-foreground/70">
            Fechando em {secondsLeft}s…
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
