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
import { PAPEL_OPTIONS } from "@/lib/crmOptions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId?: string | null;
  clientId?: string | null;
  contact?: any;
  onSaved: () => void;
}

export function ContactDialog({ open, onOpenChange, dealId, clientId, contact, onSaved }: Props) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [papel, setPapel] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (contact) {
      setNome(contact.nome); setCargo(contact.cargo || ""); setPapel(contact.papel || "");
      setEmail(contact.email || ""); setTelefone(contact.telefone || "");
      setWhatsapp(contact.whatsapp || ""); setNotas(contact.notas || "");
    } else {
      setNome(""); setCargo(""); setPapel(""); setEmail(""); setTelefone(""); setWhatsapp(""); setNotas("");
    }
  }, [open, contact]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setLoading(true);
    try {
      const payload = {
        nome: nome.trim(),
        cargo: cargo.trim() || null,
        papel: papel || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        notas: notas.trim() || null,
        deal_id: dealId || contact?.deal_id || null,
        client_id: clientId || contact?.client_id || null,
      };
      if (contact?.id) {
        const { error } = await supabase.from("deal_contacts").update(payload).eq("id", contact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deal_contacts").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      toast.success("Contato salvo");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{contact ? "Editar contato" : "Novo contato"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cargo</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} /></div>
            <div>
              <Label>Papel</Label>
              <Select value={papel} onValueChange={setPapel}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {PAPEL_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
            <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="55..." /></div>
          </div>
          <div><Label>Notas</Label><Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
