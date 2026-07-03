import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

type Periodo = "30d" | "90d" | "all" | "custom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function mascararEmail(e?: string | null) {
  if (!e) return "";
  const at = e.indexOf("@");
  return at < 0 ? "***" : `***@${e.slice(at + 1)}`;
}
function mascararTelefone(p?: string | null) {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  return d.length <= 4 ? "****" : `****${d.slice(-4)}`;
}
function mascararNome(n?: string | null) {
  if (!n) return "";
  const parts = n.trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : `${p[0] ?? ""}.`)).join(" ");
}
function mascararCNPJ(c?: string | null) {
  if (!c) return "";
  const d = c.replace(/\D/g, "");
  if (d.length < 8) return "***";
  return `${d.slice(0, 2)}.***.***/${d.slice(-6, -2)}-**`;
}

function contarPorCampo(list: any[], campo: string) {
  const m: Record<string, number> = {};
  for (const t of list) {
    const k = String(t?.[campo] ?? "—");
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}
function contarProdutos(list: any[]) {
  const m: Record<string, number> = {};
  for (const t of list) {
    const p = t.clients?.products;
    if (Array.isArray(p)) p.forEach((x) => (m[x] = (m[x] || 0) + 1));
    else if (p) m[String(p)] = (m[String(p)] || 0) + 1;
  }
  return m;
}
function calcMediaMinutos(list: any[], from: string, to: string) {
  const diffs: number[] = [];
  for (const t of list) {
    if (t[from] && t[to]) {
      diffs.push((new Date(t[to]).getTime() - new Date(t[from]).getTime()) / 60000);
    }
  }
  if (!diffs.length) return null;
  return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}
function agruparTitulos(list: any[]) {
  const m: Record<string, number> = {};
  for (const t of list) {
    const k = (t.title ?? "").trim().toLowerCase().slice(0, 60);
    if (!k) continue;
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([titulo, total]) => ({ titulo, total }));
}
const STOPWORDS = new Set("de a o e do da em um para com não uma os as no na se por mais dos das ao aos que é como está estão foi foram tem ter meu minha seu sua nosso nossa isto isso este esta esse essa aqui ali lá muito pouco todo toda todos todas ou mas também já sim não sem sobre até entre pelo pela pelos pelas quando onde qual quais quem porque porquê são ser sou fui somos".split(/\s+/));
function extrairPalavras(list: any[], campo: string) {
  const m: Record<string, number> = {};
  for (const t of list) {
    const txt = String(t?.[campo] ?? "").toLowerCase();
    const words = txt.match(/[a-záàâãéêíóôõúç]{4,}/gi) ?? [];
    for (const w of words) {
      if (STOPWORDS.has(w)) continue;
      m[w] = (m[w] || 0) + 1;
    }
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([palavra, freq]) => ({ palavra, freq }));
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[";\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportTicketsDialog({ open, onOpenChange }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("all");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [fmtCsv, setFmtCsv] = useState(true);
  const [fmtJson, setFmtJson] = useState(true);
  const [incNome, setIncNome] = useState(false);
  const [incTel, setIncTel] = useState(false);
  const [incEmail, setIncEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const resolvePeriodo = () => {
    const now = new Date();
    let inicio: Date | null = null;
    let fim: Date | null = null;
    if (periodo === "30d") inicio = new Date(now.getTime() - 30 * 86400000);
    else if (periodo === "90d") inicio = new Date(now.getTime() - 90 * 86400000);
    else if (periodo === "custom") {
      if (dataIni) inicio = new Date(dataIni + "T00:00:00");
      if (dataFim) fim = new Date(dataFim + "T23:59:59");
    }
    return { inicio, fim };
  };

  const handleExport = async () => {
    if (!fmtCsv && !fmtJson) {
      toast.error("Selecione ao menos um formato");
      return;
    }
    setLoading(true);
    try {
      const { inicio, fim } = resolvePeriodo();
      let q = supabase
        .from("tickets")
        .select(`
          id, ticket_number, title, description, descricao_problema,
          quem_reportou, acao_tentada, ja_tentou, solucao_aplicada,
          status, active_custom_stage_key, priority, category, channel,
          modulo, impacto, resultado_esperado, resultado_obtido,
          contato_nome, contato_cargo, contato_telefone,
          client_name, client_email, client_phone, organization,
          first_response_at, resolved_at, sla_deadline,
          created_at, updated_at,
          clients:clients!fk_tickets_client (
            id, razao_social, company, name, cnpj, products,
            status_nortear, contact_cargo
          ),
          ticket_interactions ( type, content, created_at, is_internal ),
          ticket_status_history ( from_status, to_status, created_at, changed_by, duration_seconds )
        `)
        .order("created_at", { ascending: false });
      if (inicio) q = q.gte("created_at", inicio.toISOString());
      if (fim) q = q.lte("created_at", fim.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      const tickets = (data ?? []) as any[];

      if (!tickets.length) {
        toast.warning("Nenhum chamado encontrado no período");
        setLoading(false);
        return;
      }

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      if (fmtJson) {
        const metadata = {
          exportado_em: new Date().toISOString(),
          total_chamados: tickets.length,
          periodo: {
            inicio: inicio?.toISOString() ?? null,
            fim: fim?.toISOString() ?? null,
            rotulo: periodo,
          },
          versao_schema: "1.0",
          mascaramento: {
            nome_contato: !incNome,
            telefone: !incTel,
            email: !incEmail,
          },
        };
        const analytics = {
          por_status: contarPorCampo(tickets, "status"),
          por_prioridade: contarPorCampo(tickets, "priority"),
          por_categoria: contarPorCampo(tickets, "category"),
          por_canal: contarPorCampo(tickets, "channel"),
          por_produto: contarProdutos(tickets),
          por_quem_reportou: contarPorCampo(tickets, "quem_reportou"),
          tempo_medio: {
            primeira_resposta_min: calcMediaMinutos(tickets, "created_at", "first_response_at"),
            resolucao_min: calcMediaMinutos(tickets, "created_at", "resolved_at"),
          },
          campos_vazios: {
            sem_descricao_problema: tickets.filter((t) => !t.descricao_problema).length,
            sem_quem_reportou: tickets.filter((t) => !t.quem_reportou).length,
            sem_acao_tentada: tickets.filter((t) => !t.acao_tentada).length,
            sem_ja_tentou: tickets.filter((t) => !t.ja_tentou).length,
            sem_modulo: tickets.filter((t) => !t.modulo).length,
            sem_categoria: tickets.filter((t) => !t.category).length,
          },
          top_titulos: agruparTitulos(tickets),
          palavras_frequentes_descricao: extrairPalavras(tickets, "descricao_problema"),
        };
        const chamados = tickets.map((t) => {
          const org = t.organization ?? t.clients?.razao_social ?? t.clients?.company ?? t.clients?.name ?? null;
          return {
            id: t.ticket_number || t.id,
            titulo: t.title,
            status_atual: t.active_custom_stage_key || t.status,
            status_base: t.status,
            prioridade: t.priority,
            categoria: t.category,
            canal_entrada: t.channel,
            produto: t.clients?.products ?? null,
            contexto_estruturado: {
              quem_reportou: t.quem_reportou,
              modulo_afetado: t.modulo,
              impacto: t.impacto,
              acao_tentada: t.acao_tentada,
              ja_tentou: t.ja_tentou,
              resultado_esperado: t.resultado_esperado,
              resultado_obtido: t.resultado_obtido,
              solucao_aplicada: t.solucao_aplicada,
            },
            cliente: {
              razao_social: org,
              cnpj_mascarado: mascararCNPJ(t.clients?.cnpj),
              status_carteira: t.clients?.status_nortear ?? null,
            },
            contato: {
              nome: incNome ? (t.contato_nome ?? t.client_name) : mascararNome(t.contato_nome ?? t.client_name),
              cargo: t.contato_cargo,
              telefone: incTel ? (t.contato_telefone ?? t.client_phone) : mascararTelefone(t.contato_telefone ?? t.client_phone),
              email: incEmail ? t.client_email : mascararEmail(t.client_email),
            },
            descricao: t.descricao_problema || t.description,
            interacoes: (t.ticket_interactions ?? []).map((i: any) => ({
              tipo: i.type,
              quando: i.created_at,
              nota_interna: i.is_internal,
              conteudo: i.content,
            })),
            historico_status: (t.ticket_status_history ?? []).map((h: any) => ({
              de: h.from_status,
              para: h.to_status,
              quando: h.created_at,
              por: h.changed_by,
              duracao_segundos: h.duration_seconds,
            })),
            tempos: {
              aberto_em: t.created_at,
              primeira_resposta: t.first_response_at,
              resolvido_em: t.resolved_at,
              sla_deadline: t.sla_deadline,
              duracao_total_min: t.resolved_at
                ? Math.round((new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 60000)
                : null,
            },
          };
        });
        downloadBlob(
          JSON.stringify({ metadata, analytics, chamados }, null, 2),
          `chamados-${stamp}.json`,
          "application/json"
        );
      }

      if (fmtCsv) {
        const headers = [
          "Número", "Título", "Status", "Prioridade", "Categoria",
          "Canal", "Produto", "Cliente",
          "Quem reportou", "Módulo", "Impacto",
          "Ação tentada", "Já tentou",
          "Resultado esperado", "Resultado obtido",
          "Descrição do problema", "Solução aplicada",
          "Contato (nome)", "Contato (telefone)", "Contato (email)",
          "Aberto em", "Primeira resposta", "Resolvido em",
          "Duração total (min)", "Total interações", "SLA cumprido",
        ];
        const rows = tickets.map((t) => {
          const org = t.organization ?? t.clients?.razao_social ?? t.clients?.company ?? t.clients?.name ?? "";
          const produto = Array.isArray(t.clients?.products) ? t.clients.products.join("|") : (t.clients?.products ?? "");
          const dur = t.resolved_at
            ? Math.round((new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 60000)
            : "";
          const sla = t.sla_deadline && t.resolved_at
            ? (new Date(t.resolved_at) <= new Date(t.sla_deadline) ? "SIM" : "NÃO")
            : "";
          return [
            t.ticket_number || String(t.id).slice(0, 8),
            t.title,
            t.active_custom_stage_key || t.status,
            t.priority,
            t.category ?? "",
            t.channel ?? "",
            produto,
            org,
            t.quem_reportou ?? "",
            t.modulo ?? "",
            t.impacto ?? "",
            t.acao_tentada ?? "",
            t.ja_tentou ?? "",
            t.resultado_esperado ?? "",
            t.resultado_obtido ?? "",
            (t.descricao_problema || t.description || "").replace(/[\r\n]+/g, " "),
            (t.solucao_aplicada || "").replace(/[\r\n]+/g, " "),
            incNome ? (t.contato_nome ?? t.client_name ?? "") : mascararNome(t.contato_nome ?? t.client_name),
            incTel ? (t.contato_telefone ?? t.client_phone ?? "") : mascararTelefone(t.contato_telefone ?? t.client_phone),
            incEmail ? (t.client_email ?? "") : mascararEmail(t.client_email),
            t.created_at,
            t.first_response_at ?? "",
            t.resolved_at ?? "",
            dur,
            (t.ticket_interactions ?? []).length,
            sla,
          ];
        });
        const csv = "\ufeff" + [headers, ...rows].map((r) => r.map(csvEscape).join(";")).join("\r\n");
        downloadBlob(csv, `chamados-${stamp}.csv`, "text/csv");
      }

      toast.success(`Exportados ${tickets.length} chamado(s)`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao exportar: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar chamados</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Período</Label>
            <RadioGroup value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="30d" id="p-30" /><Label htmlFor="p-30" className="font-normal">Últimos 30 dias</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="90d" id="p-90" /><Label htmlFor="p-90" className="font-normal">Últimos 90 dias</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="all" id="p-all" /><Label htmlFor="p-all" className="font-normal">Todos os chamados</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="custom" id="p-cus" /><Label htmlFor="p-cus" className="font-normal">Personalizado</Label></div>
            </RadioGroup>
            {periodo === "custom" && (
              <div className="flex items-center gap-2 pl-6 pt-1">
                <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9" />
                <span className="text-xs text-muted-foreground">até</span>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Formato do arquivo</Label>
            <div className="flex items-center gap-2"><Checkbox id="f-csv" checked={fmtCsv} onCheckedChange={(v) => setFmtCsv(!!v)} /><Label htmlFor="f-csv" className="font-normal">CSV (planilha)</Label></div>
            <div className="flex items-center gap-2"><Checkbox id="f-json" checked={fmtJson} onCheckedChange={(v) => setFmtJson(!!v)} /><Label htmlFor="f-json" className="font-normal">JSON estruturado (para análise por IA)</Label></div>
          </div>

          <div className="space-y-2">
            <Label>Incluir dados sensíveis?</Label>
            <p className="text-xs text-muted-foreground">Por padrão, dados de contato são mascarados.</p>
            <div className="flex items-center gap-2"><Checkbox id="s-nome" checked={incNome} onCheckedChange={(v) => setIncNome(!!v)} /><Label htmlFor="s-nome" className="font-normal">Nome do contato</Label></div>
            <div className="flex items-center gap-2"><Checkbox id="s-tel" checked={incTel} onCheckedChange={(v) => setIncTel(!!v)} /><Label htmlFor="s-tel" className="font-normal">Telefone completo</Label></div>
            <div className="flex items-center gap-2"><Checkbox id="s-mail" checked={incEmail} onCheckedChange={(v) => setIncEmail(!!v)} /><Label htmlFor="s-mail" className="font-normal">E-mail completo</Label></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
