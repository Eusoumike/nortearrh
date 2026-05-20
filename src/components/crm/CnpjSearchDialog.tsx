import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Building2, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  PLANO_OPTIONS, ORIGEM_LEAD_OPTIONS, FAIXA_COLABORADORES_OPTIONS, ETIQUETA_OPTIONS,
} from "@/lib/crmOptions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  situacao?: string;
  data_abertura?: string;
  porte?: string;
  atividade_principal?: string;
  cnae_codigo?: string;
  capital_social?: number;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  qsa?: { nome: string; qualificacao: string }[];
}

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export function CnpjSearchDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CnpjData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [existingClient, setExistingClient] = useState<{ id: string; name: string } | null>(null);

  // dados adicionais
  const [produto, setProduto] = useState<"" | "rh_digital" | "vr_beneficios" | "ambos">("");
  const [plano, setPlano] = useState("");
  const [origemLead, setOrigemLead] = useState("");
  const [fonteIndicacao, setFonteIndicacao] = useState("");
  const [faixa, setFaixa] = useState("");
  const [valor, setValor] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [criarContato, setCriarContato] = useState(true);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCnpj(""); setData(null); setApiError(null); setExistingClient(null);
    setProduto(""); setPlano(""); setOrigemLead(""); setFonteIndicacao("");
    setFaixa(""); setValor(""); setEtiqueta(""); setCriarContato(true);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const buscar = async () => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("CNPJ inválido. Informe os 14 dígitos.");
      return;
    }
    setLoading(true); setApiError(null); setData(null); setExistingClient(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke("cnpj-lookup", {
        body: { cnpj: clean },
      });
      if (error) throw error;
      if (resp?.error) { setApiError(resp.error); return; }
      const d: CnpjData = resp.data;
      setData(d);

      // verificar cliente existente
      const { data: existing } = await supabase
        .from("clients").select("id, name").eq("cnpj", formatCnpj(clean)).maybeSingle();
      if (existing) setExistingClient(existing as any);
    } catch (e: any) {
      setApiError(e?.message || "Falha ao consultar CNPJ.");
    } finally {
      setLoading(false);
    }
  };

  const isInativa = data?.situacao && !/ativa/i.test(data.situacao);

  const criarDeal = async () => {
    if (!data) return;
    if (!produto) { toast.error("Selecione o produto interessado"); return; }
    setSaving(true);
    try {
      const enderecoCompleto = [
        [data.logradouro, data.numero].filter(Boolean).join(", "),
        data.bairro, data.municipio && data.uf ? `${data.municipio}/${data.uf}` : data.municipio,
        data.cep,
      ].filter(Boolean).join(" — ");

      const title = data.razao_social || data.nome_fantasia || `CNPJ ${cnpj}`;

      const { data: deal, error } = await supabase.from("deals").insert({
        title,
        company_name: data.razao_social || data.nome_fantasia || title,
        contact_name: data.qsa?.[0]?.nome || null,
        contact_email: data.email || null,
        contact_phone: data.telefone || null,
        value: valor ? Number(valor) : 0,
        product: produto,
        stage: "lead",
        plano_contratado: plano || null,
        origem_lead: origemLead || null,
        fonte_indicacao: fonteIndicacao.trim() || null,
        faixa_colaboradores: faixa || null,
        etiqueta: etiqueta || null,
        estado: data.uf || null,
        segmento: data.atividade_principal || null,
        notes: [
          `CNPJ: ${formatCnpj(data.cnpj || cnpj)}`,
          data.porte && `Porte: ${data.porte}`,
          data.data_abertura && `Abertura: ${data.data_abertura}`,
          enderecoCompleto && `Endereço: ${enderecoCompleto}`,
        ].filter(Boolean).join("\n"),
        owner_id: user?.id,
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      // contato (primeiro sócio)
      if (criarContato && data.qsa?.[0]) {
        const s = data.qsa[0];
        await supabase.from("deal_contacts").insert({
          deal_id: deal.id,
          nome: s.nome,
          papel: "socio_administrador",
          cargo: s.qualificacao || null,
          created_by: user?.id,
        });
      }

      // histórico
      await supabase.from("crm_cnpj_consultas").insert({
        cnpj: formatCnpj(data.cnpj || cnpj),
        razao_social: data.razao_social,
        situacao: data.situacao,
        resultado: data as any,
        deal_criado: deal.id,
        consultado_por: user?.id,
      });

      toast.success(`Negócio criado! ${title} adicionado ao pipeline.`);
      onCreated?.();
      handleClose(false);
      navigate(`/crm/${deal.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar negócio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" /> Buscar empresa pela Receita Federal
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>CNPJ *</Label>
            <div className="flex gap-2">
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                onKeyDown={(e) => e.key === "Enter" && buscar()}
              />
              <Button onClick={buscar} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>

          {apiError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {apiError}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => { handleClose(false); }}>
                  Cadastrar manualmente
                </Button>
              </div>
            </div>
          )}

          {data && (
            <>
              {isInativa && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>Esta empresa está com situação <strong>{data.situacao}</strong> na Receita Federal. Você pode continuar mesmo assim.</div>
                </div>
              )}

              {existingClient && (
                <div className="rounded-md border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  ⚠️ Este CNPJ já existe na carteira: <strong>{existingClient.name}</strong>. O negócio será criado como nova oportunidade.
                </div>
              )}

              <div className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4" /> Empresa encontrada
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Field label="Razão Social" value={data.razao_social} />
                  <Field label="Nome Fantasia" value={data.nome_fantasia} />
                  <Field label="CNPJ" value={formatCnpj(data.cnpj || cnpj)} />
                  <Field label="Situação" value={data.situacao} highlight={isInativa ? "danger" : "success"} />
                  <Field label="Abertura" value={data.data_abertura} />
                  <Field label="Porte" value={data.porte} />
                  <Field label="Atividade" value={data.atividade_principal} className="col-span-2" />
                  <Field label="Endereço" value={[data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(", ")} className="col-span-2" />
                  <Field label="E-mail" value={data.email} />
                  <Field label="Telefone" value={data.telefone} />
                </div>
              </div>

              {data.qsa && data.qsa.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4" /> Sócios e Administradores
                  </div>
                  <div className="grid gap-2">
                    {data.qsa.map((s, i) => (
                      <div key={i} className="flex items-center justify-between rounded border bg-muted/30 p-2 text-sm">
                        <div className="font-medium">👤 {s.nome}</div>
                        <Badge variant="outline">{s.qualificacao}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid gap-3">
                <div className="text-sm font-semibold">Dados adicionais do negócio</div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Produto interessado *</Label>
                    <Select value={produto} onValueChange={(v: any) => setProduto(v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rh_digital">RH Digital</SelectItem>
                        <SelectItem value="vr_beneficios">VR Benefícios</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plano de interesse</Label>
                    <Select value={plano} onValueChange={setPlano}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {PLANO_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Origem do Lead</Label>
                    <Select value={origemLead} onValueChange={setOrigemLead}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>
                        {ORIGEM_LEAD_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fonte da indicação</Label>
                    <Input value={fonteIndicacao} onChange={(e) => setFonteIndicacao(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Faixa de colaboradores</Label>
                    <Select value={faixa} onValueChange={setFaixa}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>
                        {FAIXA_COLABORADORES_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor estimado (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
                  </div>
                  <div>
                    <Label>Etiqueta</Label>
                    <Select value={etiqueta} onValueChange={setEtiqueta}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>
                        {ETIQUETA_OPTIONS.map((e) => <SelectItem key={e.value} value={e.value}>{e.emoji} {e.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {data.qsa && data.qsa.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={criarContato} onCheckedChange={(v) => setCriarContato(!!v)} />
                    Cadastrar primeiro sócio (<strong>{data.qsa[0].nome}</strong>) como contato
                  </label>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancelar</Button>
          {data && (
            <Button onClick={criarDeal} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              ✓ Criar negócio no CRM
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, className, highlight }: { label: string; value?: string | number | null; className?: string; highlight?: "success" | "danger" }) {
  if (!value) return null;
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={
        highlight === "success" ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
        : highlight === "danger" ? "text-sm font-medium text-destructive"
        : "text-sm font-medium"
      }>
        {highlight === "success" ? "🟢 " : highlight === "danger" ? "🔴 " : ""}{value}
      </div>
    </div>
  );
}
