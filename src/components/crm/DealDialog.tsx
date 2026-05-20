import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Trash2, Loader2, Search, Briefcase, Building2, User } from "lucide-react";
import {
  PLANO_OPTIONS, FAIXA_COLABORADORES_OPTIONS, ETIQUETA_OPTIONS,
  SEGMENTO_OPTIONS, ESTADO_OPTIONS, ORIGEM_LEAD_OPTIONS,
  PROBABILIDADE_OPTIONS, PAPEL_OPTIONS,
} from "@/lib/crmOptions";
import type { Deal, DealProduct } from "@/pages/CrmPipeline";

const PRODUCT_OPTIONS: { value: DealProduct; label: string }[] = [
  { value: "rh_digital", label: "RH Digital" },
  { value: "vr_beneficios", label: "VR Benefícios" },
  { value: "ambos", label: "Ambos" },
];

const PORTE_OPTIONS = ["MEI", "ME", "EPP", "Médio", "Grande"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal: Deal | null;
  onSaved: () => void;
}

const maskCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

export function DealDialog({ open, onOpenChange, deal, onSaved }: Props) {
  const { user, role } = useAuth();
  const isEdit = !!deal;
  const canDelete = role === "admin" || role === "manager";

  // Seção 1 — Negócio
  const [product, setProduct] = useState<DealProduct | "">("");
  const [planoContratado, setPlanoContratado] = useState("");
  const [value, setValue] = useState<string>("");
  const [etiqueta, setEtiqueta] = useState("");
  const [probabilidade, setProbabilidade] = useState("");
  const [faixaColab, setFaixaColab] = useState("");
  const [origemLead, setOrigemLead] = useState("");
  const [fonteIndicacao, setFonteIndicacao] = useState("");

  // Seção 2 — Empresa
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [segmento, setSegmento] = useState("");
  const [estado, setEstado] = useState("");
  const [porte, setPorte] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  // Seção 3 — Contato
  const [contactName, setContactName] = useState("");
  const [cargo, setCargo] = useState("");
  const [papel, setPapel] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (!open) return;
    if (deal) {
      setProduct((deal.product ?? "") as any);
      setPlanoContratado((deal as any).plano_contratado ?? "");
      setValue(deal.value?.toString() ?? "");
      setEtiqueta((deal as any).etiqueta ?? "");
      setProbabilidade((deal as any).probabilidade ?? "");
      setFaixaColab((deal as any).faixa_colaboradores ?? "");
      setOrigemLead((deal as any).origem_lead ?? "");
      setFonteIndicacao((deal as any).fonte_indicacao ?? "");
      setRazaoSocial(deal.company_name ?? "");
      setCnpj("");
      setNomeFantasia("");
      setSegmento((deal as any).segmento ?? "");
      setEstado((deal as any).estado ?? "");
      setPorte("");
      setContactName(deal.contact_name ?? "");
      setCargo("");
      setPapel("");
      setContactEmail(deal.contact_email ?? "");
      setContactPhone(deal.contact_phone ?? "");
      setWhatsappSame(true);
      setWhatsapp("");
    } else {
      setProduct(""); setPlanoContratado(""); setValue("");
      setEtiqueta(""); setProbabilidade(""); setFaixaColab("");
      setOrigemLead(""); setFonteIndicacao("");
      setRazaoSocial(""); setCnpj(""); setNomeFantasia("");
      setSegmento(""); setEstado(""); setPorte("");
      setContactName(""); setCargo(""); setPapel("");
      setContactEmail(""); setContactPhone("");
      setWhatsappSame(true); setWhatsapp("");
    }
  }, [open, deal]);

  const buscarCnpj = async () => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("Informe os 14 dígitos do CNPJ");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("cnpj-lookup", { body: { cnpj: clean } });
      if (error) throw error;
      if (resp?.error) throw new Error(resp.error);
      const d = resp.data;
      if (d.razao_social) setRazaoSocial(d.razao_social);
      if (d.nome_fantasia) setNomeFantasia(d.nome_fantasia);
      if (d.atividade_principal) setSegmento(d.atividade_principal);
      if (d.uf) setEstado(d.uf);
      if (d.porte) setPorte(d.porte);
      if (d.email && !contactEmail) setContactEmail(d.email);
      if (d.telefone && !contactPhone) setContactPhone(maskPhone(d.telefone));
      if (d.qsa?.[0]) {
        if (!contactName) setContactName(d.qsa[0].nome);
        if (!cargo) setCargo(d.qsa[0].qualificacao || "");
      }
      toast.success("Dados preenchidos automaticamente!");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao consultar CNPJ");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Selecione o produto interessado");
      if (!razaoSocial.trim()) throw new Error("Informe a Razão Social");
      if (!contactName.trim()) throw new Error("Informe o nome do contato");

      const notesParts = [
        cnpj && `CNPJ: ${cnpj}`,
        nomeFantasia && `Nome Fantasia: ${nomeFantasia}`,
        porte && `Porte: ${porte}`,
      ].filter(Boolean);

      const payload: any = {
        title: razaoSocial.trim(),
        company_name: razaoSocial.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        value: value ? Number(value) : 0,
        product: product || null,
        plano_contratado: planoContratado || null,
        faixa_colaboradores: faixaColab || null,
        etiqueta: etiqueta || null,
        segmento: segmento || null,
        estado: estado || null,
        origem_lead: origemLead || null,
        fonte_indicacao: fonteIndicacao.trim() || null,
        probabilidade: probabilidade || null,
        notes: notesParts.length ? notesParts.join("\n") : null,
      };

      if (isEdit) {
        const { error } = await supabase.from("deals").update(payload).eq("id", deal!.id);
        if (error) throw error;
        return deal!.id;
      } else {
        const { data: created, error } = await supabase
          .from("deals")
          .insert({ ...payload, stage: "lead", created_by: user?.id, owner_id: user?.id })
          .select("id")
          .single();
        if (error) throw error;

        // Contato vinculado
        const wpp = whatsappSame ? contactPhone : whatsapp;
        await supabase.from("deal_contacts").insert({
          deal_id: created.id,
          nome: contactName.trim(),
          cargo: cargo.trim() || null,
          papel: papel || null,
          email: contactEmail.trim() || null,
          telefone: contactPhone.trim() || null,
          whatsapp: wpp?.trim() || null,
          created_by: user?.id,
        });

        return created.id;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Negócio atualizado" : "Negócio criado com sucesso!");
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar negócio" : "Novo negócio"}</DialogTitle>
          <DialogDescription>Preencha os dados do negócio, empresa e contato.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* SEÇÃO 1 — NEGÓCIO */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <SectionHeader icon={<Briefcase className="h-4 w-4" />} title="Negócio" />
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Produto interessado *">
                  <Select value={product} onValueChange={(v: DealProduct) => setProduct(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Plano de interesse">
                  <Select value={planoContratado} onValueChange={setPlanoContratado}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {PLANO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Valor estimado (R$)">
                  <Input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
                </Field>
                <Field label="Etiqueta">
                  <Select value={etiqueta} onValueChange={setEtiqueta}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {ETIQUETA_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Probabilidade">
                  <Select value={probabilidade} onValueChange={setProbabilidade}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {PROBABILIDADE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Faixa de colaboradores">
                  <Select value={faixaColab} onValueChange={setFaixaColab}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {FAIXA_COLABORADORES_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Origem do lead">
                  <Select value={origemLead} onValueChange={setOrigemLead}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {ORIGEM_LEAD_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Fonte da indicação">
                <Input value={fonteIndicacao} onChange={(e) => setFonteIndicacao(e.target.value)} placeholder="Nome do parceiro ou origem" />
              </Field>
            </div>
          </section>

          {/* SEÇÃO 2 — EMPRESA */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <SectionHeader icon={<Building2 className="h-4 w-4" />} title="Empresa" />
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Razão Social *">
                  <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
                </Field>
                <Field label="CNPJ">
                  <div className="flex gap-2">
                    <Input
                      value={cnpj}
                      onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscarCnpj())}
                    />
                    <Button type="button" variant="outline" onClick={buscarCnpj} disabled={buscandoCnpj} className="shrink-0">
                      {buscandoCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome Fantasia">
                  <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
                </Field>
                <Field label="Segmento">
                  <Select value={segmento} onValueChange={setSegmento}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {SEGMENTO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado (UF)">
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {ESTADO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Porte">
                  <Select value={porte} onValueChange={setPorte}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {PORTE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </section>

          {/* SEÇÃO 3 — CONTATO */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <SectionHeader icon={<User className="h-4 w-4" />} title="Contato principal" />
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome completo *">
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </Field>
                <Field label="Cargo">
                  <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Papel">
                  <Select value={papel} onValueChange={setPapel}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {PAPEL_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="E-mail">
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone">
                  <Input value={contactPhone} onChange={(e) => setContactPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                </Field>
                <Field label="WhatsApp">
                  <div className="space-y-1.5">
                    <Input
                      value={whatsappSame ? contactPhone : whatsapp}
                      onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                      disabled={whatsappSame}
                      placeholder="(00) 00000-0000"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={whatsappSame} onCheckedChange={(v) => setWhatsappSame(!!v)} />
                      Mesmo número do telefone
                    </label>
                  </div>
                </Field>
              </div>
            </div>
          </section>
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
              {save.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar negócio"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        {icon}
        {title}
      </div>
      <Separator className="mt-2" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
