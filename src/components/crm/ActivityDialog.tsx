import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ATIVIDADE_TIPOS, PRIORIDADE_OPTIONS } from "@/lib/crmOptions";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId?: string | null;
  clientId?: string | null;
  activity?: any; // editing existing
  onSaved: () => void;
}

export function ActivityDialog({ open, onOpenChange, dealId, clientId, activity, onSaved }: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState("ligacao");
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [agendadoPara, setAgendadoPara] = useState("");
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (activity) {
      setTipo(activity.tipo);
      setTitulo(activity.titulo);
      setPrioridade(activity.prioridade);
      setAgendadoPara(activity.agendado_para ? activity.agendado_para.slice(0, 16) : "");
      setDescricao(activity.descricao || "");
      setResultado(activity.resultado || "");
    } else {
      setTipo("ligacao");
      setTitulo("");
      setPrioridade("media");
      setAgendadoPara("");
      setDescricao("");
      setResultado("");
    }
  }, [open, activity]);

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        tipo,
        titulo: titulo.trim(),
        prioridade,
        agendado_para: agendadoPara ? new Date(agendadoPara).toISOString() : null,
        descricao: descricao.trim() || null,
        resultado: resultado.trim() || null,
        deal_id: dealId || activity?.deal_id || null,
        client_id: clientId || activity?.client_id || null,
      };
      if (activity?.id) {
        const { error } = await supabase.from("deal_activities").update(payload).eq("id", activity.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deal_activities").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      toast.success("Atividade salva");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{activity ? "Editar atividade" : "Nova atividade"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo *</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {ATIVIDADE_TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs flex flex-col items-center gap-1 transition-colors",
                    tipo === t.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  <span className="text-lg">{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Ligar para gestor de RH" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agendado para</Label>
              <Input type="datetime-local" value={agendadoPara} onChange={(e) => setAgendadoPara(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <Label>Resultado (ao realizar)</Label>
            <Textarea rows={2} value={resultado} onChange={(e) => setResultado(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
