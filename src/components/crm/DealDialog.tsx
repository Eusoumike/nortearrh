import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MultiSelect } from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLANO_OPTIONS, EXTENSAO_OPTIONS, QUEM_IMPLANTA_OPTIONS, CANAL_ORIGEM_OPTIONS,
  FAIXA_COLABORADORES_OPTIONS, ETIQUETA_OPTIONS, SEGMENTO_OPTIONS, ESTADO_OPTIONS,
  ORIGEM_LEAD_OPTIONS, PROBABILIDADE_OPTIONS,
} from "@/lib/crmOptions";
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

  // novos
  const [planoContratado, setPlanoContratado] = useState("");
  const [extensoes, setExtensoes] = useState<string[]>([]);
  const [quemImplanta, setQuemImplanta] = useState("");
  const [canalOrigem, setCanalOrigem] = useState("");
  const [faixaColab, setFaixaColab] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [segmento, setSegmento] = useState("");
  const [estado, setEstado] = useState("");
  const [origemLead, setOrigemLead] = useState("");
  const [fonteIndicacao, setFonteIndicacao] = useState("");
  const [probabilidade, setProbabilidade] = useState("");

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
      setPlanoContratado((deal as any).plano_contratado ?? "");
      setExtensoes((deal as any).extensoes ?? []);
      setQuemImplanta((deal as any).quem_implanta ?? "");
      setCanalOrigem((deal as any).canal_origem ?? "");
      setFaixaColab((deal as any).faixa_colaboradores ?? "");
      setEtiqueta((deal as any).etiqueta ?? "");
      setSegmento((deal as any).segmento ?? "");
      setEstado((deal as any).estado ?? "");
      setOrigemLead((deal as any).origem_lead ?? "");
      setFonteIndicacao((deal as any).fonte_indicacao ?? "");
      setProbabilidade((deal as any).probabilidade ?? "");
    } else {
      setTitle(""); setCompanyName(""); setClientId(null);
      setContactName(""); setContactEmail(""); setContactPhone("");
      setValue(""); setProduct(""); setStage("lead");
      setExpectedCloseDate(""); setNotes("");
      setPlanoContratado(""); setExtensoes([]); setQuemImplanta("");
      setCanalOrigem(""); setFaixaColab(""); setEtiqueta("");
      setSegmento(""); setEstado(""); setOrigemLead("");
      setFonteIndicacao(""); setProbabilidade("");
    }
  }, [open, deal]);

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Informe o nome do negócio");
      if (!companyName.trim()) throw new Error("Informe a empresa");
      const payload: any = {
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
        plano_contratado: planoContratado || null,
        extensoes,
        quem_implanta: quemImplanta || null,
        canal_origem: canalOrigem || null,
        faixa_colaboradores: faixaColab || null,
        etiqueta: etiqueta || null,
        segmento: segmento || null,
        estado: estado || null,
        origem_lead: origemLead || null,
        fonte_indicacao: fonteIndicacao.trim() || null,
        probabilidade: probabilidade || null,
      };
      const { error } = isEdit
        ? await supabase.from("deals").update(payload).eq("id", deal!.id)
        : await supabase.from("deals").insert({ ...payload, created_by: user?.id, owner_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Negócio atualizado" : "Negócio criado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deal) return;
      const { error } = await supabase.from("deals").delete().eq("id", deal.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); onSaved(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  const handleDelete = () => {
    if (!deal) return;
    if (!confirm("Excluir este negócio?")) return;
    remove.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                            onSelect={() => { setCompanyName(label); setClientId(c.id); setCompanyOpen(false); }}
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
            <div><Label>Contato</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
          </div>
          <div><Label>E-mail</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Produto</Label>
              <Select value={product} onValueChange={(v: DealProduct) => setProduct(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plano contratado</Label>
              <Select value={planoContratado} onValueChange={setPlanoContratado}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {PLANO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quem implanta</Label>
              <Select value={quemImplanta} onValueChange={setQuemImplanta}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {QUEM_IMPLANTA_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Extensões</Label>
            <MultiSelect options={EXTENSAO_OPTIONS} value={extensoes} onChange={setExtensoes} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Faixa de colaboradores</Label>
              <Select value={faixaColab} onValueChange={setFaixaColab}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {FAIXA_COLABORADORES_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etiqueta</Label>
              <Select value={etiqueta} onValueChange={setEtiqueta}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {ETIQUETA_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Canal origem</Label>
              <Select value={canalOrigem} onValueChange={setCanalOrigem}>
                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent>
                  {CANAL_ORIGEM_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem lead</Label>
              <Select value={origemLead} onValueChange={setOrigemLead}>
                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent>
                  {ORIGEM_LEAD_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Probabilidade</Label>
              <Select value={probabilidade} onValueChange={setProbabilidade}>
                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent>
                  {PROBABILIDADE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Fonte da indicação</Label><Input value={fonteIndicacao} onChange={(e) => setFonteIndicacao(e.target.value)} placeholder="Nome do parceiro ou origem" /></div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent>
                  {SEGMENTO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado (UF)</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent>
                  {ESTADO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etapa</Label>
              <Select value={stage} onValueChange={(v: DealStage) => setStage(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Previsão de fechamento</Label><Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} /></div>

          <div><Label>Observações</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isEdit && canDelete && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={remove.isPending || save.isPending} className="text-destructive hover:text-destructive">
                {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
