import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEtapasKanban, type EtapaKanban } from "@/hooks/useEtapasKanban";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketStatusPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  ticketNumber?: string | null;
  ticketTitle?: string | null;
}

const AUTO_CLOSE_SECONDS = 30;

export function TicketStatusPopup({ open, onOpenChange, ticketId, ticketNumber, ticketTitle }: TicketStatusPopupProps) {
  const qc = useQueryClient();
  const { data: etapas = [] } = useEtapasKanban();
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(AUTO_CLOSE_SECONDS);
    const interval = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const timer = setTimeout(() => onOpenChange(false), AUTO_CLOSE_SECONDS * 1000);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [open, onOpenChange]);

  const handleSelect = async (etapa: EtapaKanban) => {
    if (!ticketId || updatingSlug) return;
    if (etapa.is_system && etapa.slug === "novo") {
      onOpenChange(false);
      toast.success('Chamado criado como "Novo"!');
      return;
    }
    setUpdatingSlug(etapa.slug);
    const { error } = await supabase
      .from("tickets")
      .update({
        status: etapa.status_base,
        active_custom_stage_key: etapa.is_system ? null : etapa.slug,
      } as any)
      .eq("id", ticketId);
    setUpdatingSlug(null);
    if (error) { toast.error(error.message || "Erro ao atualizar status."); return; }
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
    qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    onOpenChange(false);
    toast.success(`Chamado movido para "${etapa.name}"!`);
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
          {etapas.map((etapa) => {
            const isUpdating = updatingSlug === etapa.slug;
            return (
              <button
                key={etapa.slug}
                type="button"
                disabled={!!updatingSlug}
                onClick={() => handleSelect(etapa)}
                style={{ borderLeftColor: etapa.color }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border/60 border-l-[3px] bg-card p-3 text-sm font-medium",
                  "hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer text-left",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: etapa.color }} />
                )}
                <span className="truncate">{etapa.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => {
              const novo = etapas.find((e) => e.is_system && e.slug === "novo");
              if (novo) handleSelect(novo); else onOpenChange(false);
            }}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Manter como "Novo" e fechar
          </button>
          <span className="text-[10px] text-muted-foreground/70">Fechando em {secondsLeft}s…</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
