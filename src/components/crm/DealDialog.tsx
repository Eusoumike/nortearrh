import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deal, DealProduct, DealStage } from "@/pages/CrmPipeline";

const STAGE_OPTIONS: { value: DealStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "contato", label: "Contato" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado_ganho", label: "Fechado Ganho" },
  { value: "fechado_perdido", label: "Fechado Perdido" },
];

const PRODUCT_OPTIONS: { value: DealProduct; label: string }[] = [
  { value: "vr_beneficios", label: "VR Benefícios" },
  { value: "rh_digital", label: "RH Digital" },
  { value: "ambos", label: "Ambos" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal: Deal | null;
  onSaved: () => void;
}

export function DealDialog({ open, onOpenChange, deal, onSaved }: Props) {
  const { user, role } = useAuth();
  const isEdit = !!deal;
  const canDelete = role === "admin" || role === "manager";

  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [value, setValue] = useState<string>("");
  const [product, setProduct] = useState<DealProduct | "">("");
  const [stage, setStage] = useState<DealStage>("lead");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, company").order("name");
      if (error) throw error;
      return data as { id: string; name: string; company: string | null }[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (deal) {
      setTitle(deal.title);
      setCompanyName(deal.company_name);
      setClientId(deal.client_id);
      setContactName(deal.contact_name ?? "");
      setContactEmail(deal.contact_email ?? "");
      setContactPhone(deal.contact_phone ?? "");
      setValue(deal.value?.toString() ?? "");
      setProduct(deal.product ?? "");
      setStage(deal.stage);
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
    } else {
      setTitle(""); setCompanyName(""); setClientId(null);
      setContactName(""); setContactEmail(""); setContactPhone("");
      setValue(""); setProduct(""); setStage("lead");
      setExpectedCloseDate(""); setNotes("");
    }
  }, [open, deal]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Informe o nome do negócio"); return; }
    if (!companyName.trim()) { toast.error("Informe a empresa"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      company_name: companyName.trim(),
      client_id: clientId,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      value: value ? Number(value) : 0,
      product: product || null,
      stage,
      expected_close_date: expectedCloseDate || null,
      notes: notes.trim() || null,
    };
    const { error } = isEdit
      ? await supabase.from("deals").update(payload).eq("id", deal!.id)
      : await supabase.from("deals").insert({ ...payload, created_by: user?.id, owner_id: user?.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Negócio atualizado" : "Negócio criado");
    onSaved();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!deal) return;
    if (!confirm("Excluir este negócio?")) return;
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Negócio excluído");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar negócio" : "Novo negócio"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label>Nome do negócio *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Implantação VR Empresa X" />
          </div>

          <div>
            <Label>Empresa *</Label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{companyName || "Selecionar ou digitar..."}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar cliente ou digitar nova..."
                    value={companyName}
                    onValueChange={(v) => { setCompanyName(v); setClientId(null); }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div className="p-2 text-xs">Pressione fora para usar "{companyName}" como nova empresa.</div>
                    </CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => {
                        const label = c.company || c.name;
                        return (
                          <CommandItem
                            key={c.id}
                            value={label}
                            onSelect={() => {
                              setCompanyName(label);
                              setClientId(c.id);
                              setCompanyOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", clientId === c.id ? "opacity-100" : "opacity-0")} />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contato</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>E-mail</Label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Produto</Label>
              <Select value={product} onValueChange={(v: DealProduct) => setProduct(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Etapa</Label>
              <Select value={stage} onValueChange={(v: DealStage) => setStage(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Previsão de fechamento</Label>
              <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isEdit && canDelete && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
