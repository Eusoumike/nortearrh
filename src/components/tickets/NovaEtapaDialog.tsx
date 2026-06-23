import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_FLOW, STATUS_LABEL, type TicketStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CORES = [
  { nome: "Azul", valor: "#3B82F6" },
  { nome: "Verde", valor: "#1D9E75" },
  { nome: "Amarelo", valor: "#F59E0B" },
  { nome: "Laranja", valor: "#C4622D" },
  { nome: "Vermelho", valor: "#D64545" },
  { nome: "Roxo", valor: "#8B5CF6" },
  { nome: "Cinza", valor: "#6B7280" },
  { nome: "Teal", valor: "#0F7173" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NovaEtapaDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0].valor);
  const [baseStatus, setBaseStatus] = useState<TicketStatus>("em_atendimento");

  const reset = () => {
    setNome("");
    setCor(CORES[0].valor);
    setBaseStatus("em_atendimento");
  };

  const criar = useMutation({
    mutationFn: async () => {
      const slug = slugify(nome);
      if (!slug) throw new Error("Informe um nome válido");
      const { data: maxRow } = await supabase
        .from("custom_ticket_stages")
        .select("ordem")
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      const proxOrdem = (maxRow?.ordem ?? 0) + 1;
      const { error } = await supabase.from("custom_ticket_stages").insert({
        stage_key: slug,
        label: nome.trim(),
        color: cor,
        base_status: baseStatus,
        ordem: proxOrdem,
        sla_hours: 8,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
      toast.success("Etapa criada!");
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar etapa"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova etapa do kanban</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome-etapa">Nome da etapa *</Label>
            <Input
              id="nome-etapa"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Aguardando aprovação"
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => setCor(c.valor)}
                  title={c.nome}
                  className={cn(
                    "h-8 w-8 rounded-full border border-border transition-transform hover:scale-110",
                    cor === c.valor && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: c.valor }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Posição no kanban (sub-etapa de)</Label>
            <Select value={baseStatus} onValueChange={(v) => setBaseStatus(v as TicketStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FLOW.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A etapa aparecerá como coluna após "{STATUS_LABEL[baseStatus]}". Chamados arrastados para ela continuam contando como "{STATUS_LABEL[baseStatus]}".
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <div className="rounded-md bg-card p-2">
              <div className="h-[3px] w-full rounded" style={{ backgroundColor: cor }} />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                  {nome.trim() || "Nova etapa"}
                </span>
                <span className="rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">0</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!nome.trim() || criar.isPending}>
            {criar.isPending ? "Criando..." : "Criar etapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
