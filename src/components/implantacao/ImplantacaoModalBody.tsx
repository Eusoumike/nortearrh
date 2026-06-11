import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ToneBadge } from "@/components/ui/tone-badge";
import { toast } from "sonner";
import {
  CheckCircle2, FileText, History, Sparkles, Plus, Trash2, ExternalLink,
  Copy, Loader2,
} from "lucide-react";
import { formatBrazilDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type ArquivoItem = { label: string; url: string; created_at?: string };

const ASSIST_TIPS: Record<string, { title: string; body: string }[]> = {
  novo_cliente: [
    { title: "Conferir cadastro completo", body: "Valide CNPJ, contato principal, produto e responsável antes de avançar para Boas-vindas." },
    { title: "Definir data de Go-Live", body: "Combine com o cliente uma data realista de Go-Live (entre 14 e 30 dias)." },
  ],
  boas_vindas: [
    { title: "E-mail de boas-vindas", body: "Use o template padrão na aba Mensagens. Confirme leitura antes de agendar o T1." },
  ],
  treinamento_1: [
    { title: "Treinamento 1 — Parametrização", body: "Cheque acessos, perfis e parâmetros iniciais. Marque T2 no mesmo encontro." },
  ],
  treinamento_2: [
    { title: "Treinamento 2 — Menus", body: "Demonstre fluxo completo de menus operacionais. Liste dúvidas no checklist." },
  ],
  treinamento_3: [
    { title: "Treinamento 3 — Fechamento", body: "Simule um fechamento real. Valide relatórios antes do Go-Live." },
  ],
  finalizado: [
    { title: "Pós Go-Live", body: "Agende follow-up em 7 e 30 dias. Solicite NPS e registre observações." },
  ],
};

export function ImplantacaoModalBody({
  item, stages,
}: {
  item: any;
  stages: { key: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <TarefasObservacoesCol item={item} />
      <ArquivosHistoricoCol item={item} />
      <AssistCol item={item} stages={stages} />
    </div>
  );
}

// ============================================================
// COL 1 — TAREFAS + OBSERVAÇÕES
// ============================================================
function TarefasObservacoesCol({ item }: { item: any }) {
  const qc = useQueryClient();
  const [obs, setObs] = useState(item.observacoes_conta ?? "");
  const [savingObs, setSavingObs] = useState(false);

  useEffect(() => { setObs(item.observacoes_conta ?? ""); }, [item.id, item.observacoes_conta]);

  const { data: checklist = [] } = useQuery({
    queryKey: ["impl-quick-checklist", item.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("id, label, concluido, etapa, ordem")
        .eq("implantacao_id", item.id)
        .order("concluido", { ascending: true })
        .order("ordem", { ascending: true })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = async (id: string, value: boolean) => {
    await supabase.from("checklist_items").update({ concluido: value }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["impl-quick-checklist", item.id] });
    qc.invalidateQueries({ queryKey: ["checklist", item.id] });
    qc.invalidateQueries({ queryKey: ["checklist-summary", item.id] });
  };

  const saveObs = async () => {
    setSavingObs(true);
    const { error } = await supabase
      .from("implantacoes")
      .update({ observacoes_conta: obs })
      .eq("id", item.id);
    setSavingObs(false);
    if (error) return toast.error("Erro ao salvar observações");
    toast.success("Observações salvas");
    qc.invalidateQueries({ queryKey: ["implantacao", item.id] });
    qc.invalidateQueries({ queryKey: ["implantacoes"] });
  };

  return (
    <Card className="p-4 space-y-4">
      <SectionTitle icon={CheckCircle2} label="Tarefas rápidas" />
      <div className="space-y-2">
        {checklist.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa cadastrada para esta implantação.</p>
        ) : checklist.map((c: any) => (
          <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer group">
            <Checkbox checked={!!c.concluido} onCheckedChange={(v) => toggle(c.id, !!v)} className="mt-0.5" />
            <span className={cn("flex-1 leading-snug", c.concluido && "line-through text-muted-foreground")}>
              {c.label}
            </span>
          </label>
        ))}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <SectionTitle icon={FileText} label="Observações da conta" />
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Anotações livres sobre a conta, particularidades, combinados…"
          rows={5}
          className="text-sm resize-none"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={saveObs} disabled={savingObs || obs === (item.observacoes_conta ?? "")}>
            {savingObs && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Salvar observações
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// COL 2 — ARQUIVOS + HISTÓRICO
// ============================================================
function ArquivosHistoricoCol({ item }: { item: any }) {
  const qc = useQueryClient();
  const arquivos: ArquivoItem[] = useMemo(() => {
    const a = item.arquivos;
    if (Array.isArray(a)) return a as ArquivoItem[];
    return [];
  }, [item.arquivos]);

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const addArquivo = async () => {
    if (!label.trim() || !url.trim()) return toast.error("Informe nome e URL do arquivo");
    setSaving(true);
    const next = [...arquivos, { label: label.trim(), url: url.trim(), created_at: new Date().toISOString() }];
    const { error } = await supabase.from("implantacoes").update({ arquivos: next as any }).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error("Erro ao adicionar arquivo");
    setLabel(""); setUrl("");
    toast.success("Arquivo adicionado");
    qc.invalidateQueries({ queryKey: ["implantacao", item.id] });
    qc.invalidateQueries({ queryKey: ["implantacoes"] });
  };

  const removeArquivo = async (idx: number) => {
    const next = arquivos.filter((_, i) => i !== idx);
    const { error } = await supabase.from("implantacoes").update({ arquivos: next as any }).eq("id", item.id);
    if (error) return toast.error("Erro ao remover arquivo");
    qc.invalidateQueries({ queryKey: ["implantacao", item.id] });
    qc.invalidateQueries({ queryKey: ["implantacoes"] });
  };

  const { data: eventos = [] } = useQuery({
    queryKey: ["impl-eventos-mini", item.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_eventos")
        .select("id, tipo, descricao, autor_nome, created_at")
        .eq("implantacao_id", item.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="p-4 space-y-4">
      <SectionTitle icon={FileText} label="Arquivos" />
      <div className="space-y-2">
        {arquivos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum arquivo anexado.</p>
        ) : arquivos.map((a, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm rounded border border-border bg-surface-muted/30 px-2 py-1.5">
            <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:text-primary inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{a.label}</span>
            </a>
            <button onClick={() => removeArquivo(idx)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="space-y-2 pt-1">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome do arquivo" className="h-8 text-sm" />
          <div className="flex gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="h-8 text-sm flex-1" />
            <Button size="sm" onClick={addArquivo} disabled={saving} className="h-8">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <SectionTitle icon={History} label="Histórico recente" />
        {eventos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem eventos registrados ainda.</p>
        ) : (
          <ul className="space-y-2">
            {eventos.map((e: any) => (
              <li key={e.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <ToneBadge tone="muted" className="text-[10px] py-0">{e.tipo}</ToneBadge>
                  <span className="text-muted-foreground">{formatBrazilDateTime(e.created_at)}</span>
                </div>
                <p className="mt-0.5 text-foreground leading-snug">{e.descricao}</p>
                {e.autor_nome && <p className="text-[10px] text-muted-foreground">por {e.autor_nome}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// COL 3 — NORTEAR ASSIST
// ============================================================
function AssistCol({ item, stages }: { item: any; stages: { key: string; label: string }[] }) {
  const tips = ASSIST_TIPS[item.etapa] ?? [];
  const stageLabel = stages.find((s) => s.key === item.etapa)?.label ?? item.etapa;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  return (
    <Card className="p-4 space-y-4 bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <SectionTitle icon={Sparkles} label="Nortear Assist" />
      <div className="text-xs text-muted-foreground">
        Sugestões inteligentes para a etapa atual: <span className="font-medium text-foreground">{stageLabel}</span>
      </div>

      <div className="space-y-3">
        {tips.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem sugestões para esta etapa.</p>
        ) : tips.map((t, i) => (
          <div key={i} className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium leading-tight">{t.title}</h4>
              <button onClick={() => copy(t.body)} className="text-muted-foreground hover:text-primary shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{t.body}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-primary/10 pt-3 text-[11px] text-muted-foreground">
        💡 Dica: registre observações importantes no painel ao lado para que o Assist evolua suas sugestões.
      </div>
    </Card>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="h-4 w-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}
