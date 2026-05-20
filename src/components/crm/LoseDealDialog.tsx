import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { MOTIVO_PERDA_OPTIONS } from "@/lib/crmOptions";
import type { Deal } from "@/pages/CrmPipeline";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal: Deal | null;
  onDone: () => void;
}

export function LoseDealDialog({ open, onOpenChange, deal, onDone }: Props) {
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  if (!deal) return null;

  const handleConfirm = async () => {
    if (!motivo) {
      toast.error("Selecione um motivo");
      return;
    }
    setLoading(true);
    try {
      const notes = obs.trim()
        ? `${deal.notes ? deal.notes + "\n\n" : ""}[Perda] ${motivo} — ${obs.trim()}`
        : deal.notes;
      const { error } = await supabase
        .from("deals")
        .update({ stage: "fechado_perdido", motivo_perda: motivo, notes })
        .eq("id", deal.id);
      if (error) throw error;
      toast.success("Negócio marcado como perdido");
      onDone();
      onOpenChange(false);
      setMotivo(""); setObs("");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" /> Negócio perdido
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {MOTIVO_PERDA_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
