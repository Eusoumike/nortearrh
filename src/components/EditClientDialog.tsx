import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, Copy, Monitor, Building2, User, Search, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { ClientHealth } from "@/lib/constants";

const STATUS_OPTIONS: { value: ClientHealth; label: string }[] = [
  { value: "saudavel", label: "Ativo" },
  { value: "em_atencao", label: "Em risco" },
  { value: "critico", label: "Inativo" },
];

const PAPEL_OPTIONS = [
  { value: "gestor_rh", label: "Gestor RH" },
  { value: "responsavel_implantacao", label: "Responsável Implantação" },
  { value: "socio", label: "Sócio" },
  { value: "socio_administrador", label: "Sócio-Administrador" },
  { value: "contador", label: "Contador" },
  { value: "colaborador", label: "Colaborador" },
];

const PORTE_OPTIONS = ["MEI", "ME", "EPP", "DEMAIS", "Grande"];

interface EditClientDialogProps {
  client: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
    );
  }
  return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
}

function defaultForm(c: any | null) {
  return {
    // empresa
    razao_social: c?.razao_social ?? c?.company ?? "",
    nome_fantasia: c?.nome_fantasia ?? "",
    cnpj: c?.cnpj ? maskCnpj(c.cnpj) : "",
    situacao_receita: c?.situacao_receita ?? "",
    data_abertura: c?.data_abertura ?? "",
    porte: c?.porte ?? "",
    atividade_principal: c?.atividade_principal ?? "",
    segmento: c?.segmento ?? "",
    // endereço
    cep: c?.cep ? maskCep(c.cep) : "",
    logradouro: c?.logradouro ?? "",
    numero: c?.numero ?? "",
    complemento: c?.complemento ?? "",
    bairro: c?.bairro ?? "",
    municipio: c?.municipio ?? "",
    estado: c?.estado ?? "",
    // contato principal
    contact_name: c?.contact_name ?? c?.name ?? "",
    contact_cargo: c?.contact_cargo ?? c?.cargo ?? "",
    contact_papel: c?.contact_papel ?? "",
    contact_email: c?.contact_email ?? c?.email ?? "",
    contact_phone: c?.contact_phone ?? c?.phone ?? "",
    contact_whatsapp: c?.contact_whatsapp ?? c?.whatsapp ?? "",
    contact_data_nascimento: c?.contact_data_nascimento ?? "",
    // operacionais
    billing_email: c?.billing_email ?? "",
    health: (c?.health ?? "saudavel") as ClientHealth,
    notes: c?.notes ?? "",
    anydesk_id: c?.anydesk_id ?? "",
    products: (c?.products ?? []) as string[],
    contract_value: c?.contract_value ?? "",
    fonte_indicacao: c?.fonte_indicacao ?? "",
    parceiro_id: c?.parceiro_id ?? "",
  };
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEdit = !!client?.id;
  const [form, setForm] = useState<any>(null);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [wpSameAsPhone, setWpSameAsPhone] = useState(false);

  useEffect(() => {
    if (open) setForm(defaultForm(client));
  }, [open, client]);

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros-ativos-edit"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("id, nome, contato, ativo, observacoes, percentual_rh, percentual_rh_tipo, percentual_vr")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [rhTipo, setRhTipo] = useState<"primeira_mensalidade" | "recorrencia">("primeira_mensalidade");
  const [rhPct, setRhPct] = useState<string>("0");
  const [rhConfigId, setRhConfigId] = useState<string | null>(null);
  const [vrPct, setVrPct] = useState<string>("0");
  const [vrConfigId, setVrConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !client?.id) return;
    (async () => {
      if (!client.parceiro_id) {
        setRhConfigId(null);
        setRhTipo("primeira_mensalidade");
        setRhPct("0");
        setVrConfigId(null);
        setVrPct("0");
        return;
      }
      const { data: rows } = await supabase
        .from("configuracoes_parceiro")
        .select("id, tipo_repasse, percentual, produto")
        .eq("client_id", client.id)
        .eq("parceiro_id", client.parceiro_id)
        .eq("ativo", true);
      const rh = (rows ?? []).find((r: any) => r.produto === "rh_digital");
      const vr = (rows ?? []).find((r: any) => r.produto === "vr_beneficios");
      if (rh) { setRhConfigId(rh.id); setRhTipo(rh.tipo_repasse as any); setRhPct(String(rh.percentual ?? 0)); }
      else { setRhConfigId(null); setRhTipo("primeira_mensalidade"); setRhPct("0"); }
      if (vr) { setVrConfigId(vr.id); setVrPct(String(vr.percentual ?? 0)); }
      else { setVrConfigId(null); setVrPct("0"); }
    })();
  }, [open, client?.id, client?.parceiro_id]);

  const applyParceiroDefaults = (parceiroId: string) => {
    const p: any = parceiros.find((x: any) => x.id === parceiroId);
    if (!p) return;
    setRhTipo((p.percentual_rh_tipo as any) ?? "primeira_mensalidade");
    setRhPct(String(p.percentual_rh ?? 0));
    setVrPct(String(p.percentual_vr ?? 0));
  };

  const rhPctNum = Number(rhPct || 0);
  const rhInvalid = rhTipo === "recorrencia" && (rhPctNum < 0 || rhPctNum > 10);
  const vrPctNum = Number(vrPct || 0);
  const vrInvalid = vrPctNum < 0 || vrPctNum > 50;

  async function buscarCnpj() {
    const limpo = (form?.cnpj ?? "").replace(/\D/g, "");
    if (limpo.length !== 14) {
      toast.error("CNPJ inválido — preencha os 14 dígitos.");
      return;
    }
    setLoadingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setForm((f: any) => ({
        ...f,
        razao_social: data.razao_social || f.razao_social,
        nome_fantasia: data.nome_fantasia || f.nome_fantasia,
        situacao_receita: data.descricao_situacao_cadastral || f.situacao_receita,
        data_abertura: data.data_inicio_atividade || f.data_abertura,
        porte: data.porte || f.porte,
        atividade_principal: data.cnae_fiscal_descricao || f.atividade_principal,
        logradouro: data.logradouro || f.logradouro,
        numero: data.numero || f.numero,
        complemento: data.complemento || f.complemento,
        bairro: data.bairro || f.bairro,
        municipio: data.municipio || f.municipio,
        estado: data.uf || f.estado,
        cep: data.cep ? maskCep(String(data.cep)) : f.cep,
        contact_email: f.contact_email || data.email || "",
        contact_phone:
          f.contact_phone ||
          (data.ddd_telefone_1 ? maskPhone(String(data.ddd_telefone_1)) : ""),
        ...(data.qsa && data.qsa.length > 0
          ? {
              contact_name: f.contact_name || data.qsa[0].nome_socio || "",
              contact_cargo: f.contact_cargo || data.qsa[0].qualificacao_socio || "",
              contact_papel: f.contact_papel || "socio_administrador",
            }
          : {}),
      }));
      toast.success("Dados preenchidos pela Receita Federal!");
    } catch {
      toast.error("CNPJ não encontrado na Receita Federal.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  async function buscarCep() {
    const limpo = (form?.cep ?? "").replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setForm((f: any) => ({
        ...f,
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        municipio: data.localidade || f.municipio,
        estado: data.uf || f.estado,
        complemento: data.complemento || f.complemento,
      }));
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const razao = (form.razao_social || "").trim();
      if (!razao) throw new Error("Razão social é obrigatória.");
      const contato = (form.contact_name || "").trim();
      if (!contato) throw new Error("Nome do contato é obrigatório.");

      const adIdRaw = form.anydesk_id?.trim() ?? "";
      let anydeskIdValue: string | null = null;
      if (adIdRaw) {
        const idDigits = adIdRaw.replace(/[\s-]/g, "");
        if (!/^\d+$/.test(idDigits)) throw new Error("ID do AnyDesk inválido: use apenas números.");
        if (idDigits.length < 6 || idDigits.length > 12) throw new Error("ID do AnyDesk inválido: 6 a 12 dígitos.");
        anydeskIdValue = idDigits;
      }

      if (form.parceiro_id && rhInvalid) throw new Error("% de recorrência RH deve estar entre 0 e 10.");
      if (form.parceiro_id && vrInvalid) throw new Error("% sobre VR Benefícios deve estar entre 0 e 50.");

      const payload: any = {
        company: razao,
        razao_social: razao,
        nome_fantasia: form.nome_fantasia?.trim() || null,
        name: contato,
        contact_name: contato,
        cnpj: form.cnpj?.replace(/\D/g, "") || null,
        situacao_receita: form.situacao_receita || null,
        data_abertura: form.data_abertura || null,
        porte: form.porte || null,
        atividade_principal: form.atividade_principal?.trim() || null,
        segmento: form.segmento || null,
        cep: form.cep?.replace(/\D/g, "") || null,
        logradouro: form.logradouro?.trim() || null,
        numero: form.numero?.trim() || null,
        complemento: form.complemento?.trim() || null,
        bairro: form.bairro?.trim() || null,
        municipio: form.municipio?.trim() || null,
        estado: form.estado?.trim() || null,
        contact_cargo: form.contact_cargo?.trim() || null,
        cargo: form.contact_cargo?.trim() || null,
        contact_papel: form.contact_papel || null,
        contact_email: form.contact_email?.trim() || null,
        email: form.contact_email?.trim() || null,
        contact_phone: form.contact_phone?.trim() || null,
        phone: form.contact_phone?.trim() || null,
        contact_whatsapp: form.contact_whatsapp?.trim() || null,
        whatsapp: form.contact_whatsapp?.trim() || null,
        contact_data_nascimento: form.contact_data_nascimento || null,
        billing_email: form.billing_email?.trim() || null,
        health: form.health,
        notes: form.notes?.trim() || null,
        anydesk_id: anydeskIdValue,
        products: form.products ?? [],
        contract_value:
          form.contract_value === "" || form.contract_value == null ? null : Number(form.contract_value),
        fonte_indicacao: form.fonte_indicacao?.trim() || null,
        parceiro_id: form.parceiro_id || null,
      };

      let clientId = client?.id as string | undefined;
      if (isEdit) {
        const { error } = await supabase.from("clients").update(payload).eq("id", clientId!);
        if (error) throw error;
      } else {
        if (!user) throw new Error("Não autenticado.");
        const { data: ins, error } = await supabase
          .from("clients")
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        clientId = ins.id;
      }

      if (form.parceiro_id && clientId) {
        const pctRh = rhTipo === "primeira_mensalidade" ? 100 : rhPctNum;
        if (rhConfigId) {
          const { error: e2 } = await supabase
            .from("configuracoes_parceiro")
            .update({ tipo_repasse: rhTipo, percentual: pctRh, ativo: true } as any)
            .eq("id", rhConfigId);
          if (e2) throw e2;
        } else {
          const { error: e2 } = await supabase.from("configuracoes_parceiro").insert({
            parceiro_id: form.parceiro_id,
            client_id: clientId,
            produto: "rh_digital",
            tipo_repasse: rhTipo,
            percentual: pctRh,
            ativo: true,
          } as any);
          if (e2) throw e2;
        }
        if (vrConfigId) {
          const { error: e3 } = await supabase
            .from("configuracoes_parceiro")
            .update({ tipo_repasse: "primeira_carga_vr", percentual: vrPctNum, ativo: vrPctNum > 0 } as any)
            .eq("id", vrConfigId);
          if (e3) throw e3;
        } else if (vrPctNum > 0) {
          const { error: e3 } = await supabase.from("configuracoes_parceiro").insert({
            parceiro_id: form.parceiro_id,
            client_id: clientId,
            produto: "vr_beneficios",
            tipo_repasse: "primeira_carga_vr",
            percentual: vrPctNum,
            ativo: true,
          } as any);
          if (e3) throw e3;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (client?.id) qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients-min"] });
      qc.invalidateQueries({ queryKey: ["clients-combobox"] });
      qc.invalidateQueries({ queryKey: ["dashboard-clients"] });
      toast.success(isEdit ? "Cliente atualizado." : "Cliente criado.");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar."),
  });

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {/* SEÇÃO 1 — EMPRESA */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Dados da Empresa</h3>
            </div>
            <Separator />

            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <div className="flex gap-1.5">
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                />
                <Button type="button" variant="outline" onClick={buscarCnpj} disabled={loadingCnpj}>
                  {loadingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Buscar</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Busca dados na Receita Federal (BrasilAPI).</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Razão Social *</Label>
                <Input
                  required
                  value={form.razao_social}
                  onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome Fantasia</Label>
                <Input
                  value={form.nome_fantasia}
                  onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Situação na Receita</Label>
                <Input
                  value={form.situacao_receita}
                  onChange={(e) => setForm({ ...form, situacao_receita: e.target.value })}
                  placeholder="Ativa / Inativa / Suspensa"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Abertura</Label>
                <Input
                  type="date"
                  value={form.data_abertura ?? ""}
                  onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Porte</Label>
                <Select value={form.porte || "none"} onValueChange={(v) => setForm({ ...form, porte: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {PORTE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Atividade Principal (CNAE)</Label>
                <Input
                  value={form.atividade_principal}
                  onChange={(e) => setForm({ ...form, atividade_principal: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Segmento</Label>
                <Input
                  value={form.segmento}
                  onChange={(e) => setForm({ ...form, segmento: e.target.value })}
                  placeholder="Ex.: Indústria, Comércio…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status do cliente</Label>
                <Select value={form.health} onValueChange={(v) => setForm({ ...form, health: v as ClientHealth })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Endereço */}
            <div className="rounded-lg border border-border bg-surface-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Endereço
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={form.cep}
                      onChange={(e) => setForm({ ...form, cep: maskCep(e.target.value) })}
                      onBlur={buscarCep}
                      placeholder="00000-000"
                      inputMode="numeric"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={buscarCep} disabled={loadingCep}>
                      {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Logradouro</Label>
                  <Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Complemento</Label>
                  <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Município</Label>
                  <Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado (UF)</Label>
                  <Input
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase().slice(0, 2) })}
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO 2 — CONTATO */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Contato Principal</h3>
            </div>
            <Separator />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input
                  required
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={form.contact_cargo} onChange={(e) => setForm({ ...form, contact_cargo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select
                  value={form.contact_papel || "none"}
                  onValueChange={(v) => setForm({ ...form, contact_papel: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {PAPEL_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => {
                    const v = maskPhone(e.target.value);
                    setForm((f: any) => ({
                      ...f,
                      contact_phone: v,
                      ...(wpSameAsPhone ? { contact_whatsapp: v } : {}),
                    }));
                  }}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <Input
                  value={form.contact_whatsapp}
                  disabled={wpSameAsPhone}
                  onChange={(e) => setForm({ ...form, contact_whatsapp: maskPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={wpSameAsPhone}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      setWpSameAsPhone(checked);
                      if (checked) setForm((f: any) => ({ ...f, contact_whatsapp: f.contact_phone }));
                    }}
                  />
                  Mesmo número do telefone
                </label>
              </div>
              <div className="space-y-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={form.contact_data_nascimento ?? ""}
                  onChange={(e) => setForm({ ...form, contact_data_nascimento: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail financeiro</Label>
                <Input
                  type="email"
                  value={form.billing_email}
                  onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* PRODUTOS */}
          <div className="space-y-3 rounded-lg border border-border bg-surface-muted/30 p-3">
            <div className="text-sm font-medium">Produto(s) contratado(s)</div>
            <div className="flex flex-wrap gap-4">
              {[{ id: "rh_digital", label: "RH Digital (Ponto)" }, { id: "vr_beneficios", label: "VR Benefícios" }].map((p) => {
                const checked = (form.products ?? []).includes(p.id);
                return (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const set = new Set<string>(form.products ?? []);
                        if (v) set.add(p.id); else set.delete(p.id);
                        setForm({ ...form, products: Array.from(set) });
                      }}
                    />
                    {p.label}
                  </label>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label>Valor de contrato (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.contract_value}
                onChange={(e) => setForm({ ...form, contract_value: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* ANYDESK */}
          <div className="space-y-2 rounded-lg border border-border bg-surface-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Acesso Remoto
            </div>
            <div className="space-y-1.5">
              <Label>ID AnyDesk</Label>
              <div className="flex gap-1.5">
                <Input
                  value={form.anydesk_id}
                  onChange={(e) => setForm({ ...form, anydesk_id: e.target.value })}
                  placeholder="000 000 000"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!form.anydesk_id?.trim()}
                  onClick={() => {
                    navigator.clipboard.writeText(form.anydesk_id);
                    toast.success("ID copiado");
                  }}
                  title="Copiar ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fonte de indicação</Label>
              <Input
                value={form.fonte_indicacao}
                onChange={(e) => setForm({ ...form, fonte_indicacao: e.target.value })}
                placeholder="Como nos conheceu?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parceiro</Label>
              <Select
                value={form.parceiro_id || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    setForm({ ...form, parceiro_id: "" });
                    setRhConfigId(null); setRhTipo("primeira_mensalidade"); setRhPct("0");
                    setVrConfigId(null); setVrPct("0");
                  } else {
                    setForm({ ...form, parceiro_id: v });
                    applyParceiroDefaults(v);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sem parceiro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem parceiro</SelectItem>
                  {parceiros.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.parceiro_id && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-border bg-surface-muted/30 p-3">
                <div className="text-sm font-medium">% sobre RH Digital</div>
                <Select value={rhTipo} onValueChange={(v) => setRhTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeira_mensalidade">Primeira mensalidade — 100% (pagamento único)</SelectItem>
                    <SelectItem value="recorrencia">Recorrência — % mensal (máx. 10%)</SelectItem>
                  </SelectContent>
                </Select>
                {rhTipo === "primeira_mensalidade" ? (
                  <p className="text-xs text-muted-foreground">100% da primeira mensalidade</p>
                ) : (
                  <div className="space-y-1.5">
                    <Label>% recorrência RH</Label>
                    <Input type="number" min="0" max="10" step="0.01" value={rhPct} onChange={(e) => setRhPct(e.target.value)} />
                    {rhInvalid && <p className="text-xs text-destructive">Valor entre 0 e 10.</p>}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-surface-muted/30 p-3">
                <div className="text-sm font-medium">% sobre VR Benefícios</div>
                <div className="space-y-1.5">
                  <Label>% VR (primeira carga)</Label>
                  <Input type="number" min="0" max="50" step="0.01" placeholder="Ex: 17.5" value={vrPct} onChange={(e) => setVrPct(e.target.value)} />
                  {vrInvalid && <p className="text-xs text-destructive">Valor entre 0 e 50.</p>}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="submit"
              disabled={save.isPending || !form.razao_social?.trim() || !form.contact_name?.trim()}
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
