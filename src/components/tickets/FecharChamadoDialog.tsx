import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader2, CheckCircle2 } from "lucide-react";
import { ORIGEM_PROBLEMA_OPTIONS } from "@/lib/constants";
import type { TicketAlvoEncerramento } from "@/hooks/useEncerrarChamado";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  ticket: TicketAlvoEncerramento | null;
  onSuccess?: () => void;
}

const MAX_SOLUCAO = 300;

export function FecharChamadoDialog({ open, onClose, ticket, onSuccess }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [origem, setOrigem] = useState<string>("");
  const [solucao, setSolucao] = useState("");
  const [viraArtigo, setViraArtigo] = useState(false);

  useEffect(() => {
    if (open) {
      setOrigem("");
      setSolucao("");
      setViraArtigo(false);
    }
  }, [open, ticket?.id]);

  const encerrar = useMutation({
    mutationFn: async () => {
      if (!ticket) throw new Error("Chamado inválido");
      if (!origem) throw new Error("Selecione a origem do problema");
      const solucaoTrim = solucao.trim();
      if (solucaoTrim.length < 10)
        throw new Error("Descreva a solução em pelo menos 10 caracteres");

      const { error: updErr } = await supabase
        .from("tickets")
        .update({
          status: "resolvido",
          active_custom_stage_key: null,
          origem_problema: origem,
          solucao_curta: solucaoTrim,
          vira_artigo_assist: viraArtigo,
        } as any)
        .eq("id", ticket.id);
      if (updErr) throw updErr;

      if (viraArtigo) {
        const { error: artErr } = await supabase.from("assist_artigos").insert({
          titulo: ticket.tema || ticket.title || "Artigo sem título",
          problema_relatado: ticket.description || ticket.descricao_problema || null,
          causa_raiz: origem,
          passos_solucao: solucaoTrim,
          modulo_afetado: ticket.modulo_afetado ?? null,
          tema_relacionado: ticket.tema ?? null,
          origem_ticket_id: ticket.id,
          tags: [ticket.modulo_afetado, origem].filter(Boolean) as string[],
          publicado: false,
          criado_por: user?.id ?? null,
        } as any);
        if (artErr) {
          console.warn("Falha ao criar rascunho Assist:", artErr);
          return { artigoOk: false };
        }
        return { artigoOk: true };
      }
      return { artigoOk: null };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket?.id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      if (res.artigoOk === true) toast.success("Chamado encerrado. Rascunho criado no Assist.");
      else if (res.artigoOk === false)
        toast.warning("Chamado encerrado, mas houve erro ao criar o rascunho no Assist.");
      else toast.success("Chamado encerrado.");
      onSuccess?.();
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao encerrar chamado."),
  });

  const disabled =
    encerrar.isPending || !origem || solucao.trim().length < 10;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Encerrar chamado {ticket?.ticket_number ? `#${ticket.ticket_number}` : ""}
          </DialogTitle>
          {ticket?.tema && (
            <DialogDescription>
              Tema: <span className="font-medium text-foreground">{ticket.tema}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="origem">
              Origem do problema <span className="text-danger">*</span>
            </Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger id="origem">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ORIGEM_PROBLEMA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="solucao">
              O que resolveu? <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="solucao"
              rows={3}
              maxLength={MAX_SOLUCAO}
              value={solucao}
              onChange={(e) => setSolucao(e.target.value)}
              placeholder="Ex: PIS do colaborador estava errado. Ajustado no cadastro e sincronizado."
            />
            <div className="flex justify-end text-[11px] text-muted-foreground">
              {solucao.length}/{MAX_SOLUCAO}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 cursor-pointer">
            <Checkbox
              checked={viraArtigo}
              onCheckedChange={(v) => setViraArtigo(v === true)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                Este chamado vira artigo do Assist
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Cria um rascunho na base de conhecimento. Você revisa e publica depois.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                Ajuda a base de conhecimento a crescer com casos reais.
              </p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={encerrar.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => encerrar.mutate()} disabled={disabled}>
            {encerrar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
