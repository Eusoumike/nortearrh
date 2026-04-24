import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ToneBadge } from "@/components/ui/tone-badge";
import { toast } from "sonner";
import {
  Plus, Loader2, GripVertical, Copy, Trash2, Send, Settings2, Search, X, Eye, EyeOff,
  ExternalLink, ArrowRightLeft, CheckCircle2, MessageSquare, StickyNote, AlertCircle,
} from "lucide-react";
import { initials, formatBrazilDateTime, formatBrazilDate, formatCnpj } from "@/lib/formatters";
import { cn } from "@/lib/utils";

// ============================================================
// TIPOS, CONSTANTES E TEMPLATES
// ============================================================

type StageKey =
  | "novo_cliente" | "boas_vindas" | "treinamento_1"
  | "treinamento_2" | "treinamento_3" | "finalizado";

const DEFAULT_STAGES: { key: StageKey; label: string; tone: "muted" | "info" | "primary" | "warning" | "success" | "neutral" }[] = [
  { key: "novo_cliente",   label: "Novo Cliente",                       tone: "muted" },
  { key: "boas_vindas",    label: "E-mail de Boas-vindas",              tone: "info" },
  { key: "treinamento_1",  label: "Treinamento 1 — Parametrização",     tone: "primary" },
  { key: "treinamento_2",  label: "Treinamento 2 — Menus",              tone: "warning" },
  { key: "treinamento_3",  label: "Treinamento 3 — Fechamento",         tone: "accent" as any },
  { key: "finalizado",     label: "Finalizado",                         tone: "success" },
];
const DEFAULT_STAGE_KEYS = new Set<string>(DEFAULT_STAGES.map((s) => s.key));
const DEFAULT_STAGE_LABEL: Record<string, string> = Object.fromEntries(DEFAULT_STAGES.map((s) => [s.key, s.label]));

const PRODUTOS: { value: string; label: string }[] = [
  { value: "vr_rh_digital", label: "VR + RH Digital" },
  { value: "rh_digital",    label: "RH Digital" },
  { value: "vr_beneficios", label: "VR Benefícios" },
];
const PRODUTO_LABEL: Record<string, string> = Object.fromEntries(PRODUTOS.map((p) => [p.value, p.label]));

const DEFAULT_CHECKLIST: Record<StageKey, string[]> = {
  novo_cliente: [
    "Contrato assinado",
    "Dados da empresa coletados (CNPJ, endereço, responsável)",
    "Acesso ao sistema criado para o cliente",
    "E-mail de boas-vindas enviado",
    "Treinamento 1 agendado",
  ],
  boas_vindas: [
    "E-mail de boas-vindas enviado",
    "Link de agendamento do Treinamento 1 enviado",
    "Confirmação de recebimento pelo cliente",
    "Data e horário do Treinamento 1 confirmados",
  ],
  treinamento_1: [
    "Unidades de negócio configuradas",
    "Centros de custo configurados",
    "Departamentos criados",
    "Turnos e horários de trabalho configurados",
    "Segurança e perfis de acesso definidos",
    "Restrição de dispositivos configurada (se aplicável)",
    "Painel de Risco configurado (se aplicável)",
    "Férias — módulo apresentado",
    "Controle de ponto — configurações gerais",
    "Movimentação de turnos / Sobreaviso (se aplicável)",
    "Cercas virtuais e pontos de referência (se aplicável)",
    "Motivos de ajustes cadastrados",
    "Feriados cadastrados",
    "Exceções de jornada e atestados configurados",
    "Compensação em Cascata (se aplicável)",
    "Etiqueta de ponto configurada (se aplicável)",
    "Equipes criadas",
    "Cargos cadastrados",
    "Colaboradores importados / cadastrados",
    "Alocação de colaboradores nas unidades/departamentos",
    "Integrações configuradas (se aplicável)",
    "Relógios de ponto vinculados (se aplicável)",
    "Exportação de folha de pagamento configurada (se aplicável)",
    "Extensões contratadas configuradas",
    "Acesso ao suporte liberado (Co-Browser)",
    "Co-Browser liberado para o suporte VR (Configurações > Segurança > Liberar acesso ao suporte)",
    "Verificar: empresa tem colaboradores com regime especial? (Ponto por Exceção ou NR17 — pausas obrigatórias)",
    "Treinamento 1 concluído — cliente apto para usar o sistema",
  ],
  treinamento_2: [
    "Indicadores — painel de banco de horas apresentado",
    "Painel de Risco — apresentado e configurado",
    "Resumo — abas Status, Evento e Frequência apresentadas",
    "Meu Perfil — apresentado ao cliente",
    "Meu Ponto — apresentado ao colaborador",
    "Universo do Tempo — apresentado",
    "Minha Equipe — gestão de equipes apresentada",
    "Solicitações — fluxo de aprovação apresentado",
    "Classificação de horas extras — configurado",
    "Escala — apresentada (se aplicável)",
    "Férias e Folgas — fluxo apresentado",
    "Controle de Ponto — lançamento de ocorrências e ajustes",
    "Relatórios — principais relatórios apresentados",
    "Consulta de Processos — apresentado",
    "Assistente Virtual — apresentado",
    "Configurações do sistema — revisão geral",
    "Central de Ajuda — cliente orientado sobre o recurso",
    "Vídeo tutorial de acesso ao SuperApp VR enviado ao RH (https://www.youtube.com/watch?v=nG_s2MJDshc&t=38s)",
    "Canal de envio do vídeo definido (WhatsApp / E-mail / Ambos)",
    "RH orientado a repassar o tutorial aos colaboradores",
    "Método de registro demonstrado com colaborador piloto (pelo menos 1 colaborador conseguiu registrar o ponto)",
    "Treinamento 2 concluído — cliente operando o sistema",
  ],
  treinamento_3: [
    "Processo de fechamento explicado ao cliente",
    "Acesso ao menu Controle de Ponto → Ações → Fechamento",
    "Parâmetros do fechamento configurados (período, unidade/CC)",
    "Ajustes obrigatórios explicados (pontos ímpares, faltas)",
    "Validação de totais — cliente sabe verificar",
    "Tratamento de horas extras e banco de horas",
    "Exportação do espelho de ponto",
    "Exportação para folha de pagamento",
    "Rotina mensal definida (quando fechar, quem fecha)",
    "Cliente realizou um fechamento supervisionado",
    "Dúvidas do fechamento esclarecidas",
    "Assinatura eletrônica do espelho explicada (SuperApp VR > Meu Ponto > Espelho de Ponto > Assinar)",
    "Recálculo de pontos explicado (Controle de Ponto > Configurações > Recalcular pontos)",
    "Banco de horas: regras de compensação definidas com o cliente",
    "Primeiro fechamento supervisionado realizado com sucesso",
    "Arquivos fiscais apresentados (AFD/AEJ) — se aplicável",
    "Treinamento 3 concluído — cliente independente",
  ],
  finalizado: [
    "Todos os 3 treinamentos concluídos",
    "Cliente registra ponto sem assistência",
    "Primeiro fechamento real realizado com sucesso",
    "Contato de pós-implantação realizado (7 dias após finalizar)",
    "Cliente orientado sobre canais de suporte",
    "Implantação encerrada ✓",
  ],
};

const MESSAGE_TEMPLATES = [
  {
    key: "boas_vindas",
    title: "Boas-vindas",
    body: `Olá, {nome}! 🎉 Seja bem-vindo(a) à Nortear!

Estamos muito felizes em tê-lo(a) como cliente. Sua implantação já está em andamento e em breve entraremos em contato para agendar nosso primeiro treinamento.

Qualquer dúvida, estou à disposição!

Abraço,
Maykon — Nortear`,
  },
  {
    key: "agendamento",
    title: "Agendamento de treinamento",
    body: `Oi, {nome}! Tudo bem?

Passando para confirmar nosso treinamento. Por favor, acesse o link abaixo para escolher o melhor horário:

vempraponto.pipedrive.com/scheduler/qlapKRSp/treinamento-1-parametrizacao

Qualquer dúvida é só chamar! 👍`,
  },
  {
    key: "lembrete_fechamento",
    title: "Lembrete de fechamento (dia 15)",
    body: `Oi, {nome}! 👋

Estamos na metade do mês — hora de adiantar o fechamento de ponto.

Acesse: Minha equipe > Ocorrências e verifique:
1. Falta não justificada
2. Pontos ímpares
3. Pontos menores que o previsto

Qualquer dúvida, me chama aqui! 🙋`,
  },
  {
    key: "parabens",
    title: "Parabéns pela conclusão",
    body: `{nome}, parabéns! 🎊

Sua implantação foi concluída com sucesso! O Pontomais já está funcionando plenamente.

Lembre-se: estou sempre disponível para suporte. Qualquer dúvida, é só abrir um chamado ou me chamar aqui.

Obrigado pela confiança! 💚`,
  },
];

// ============================================================
// HELPERS
// ============================================================

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00-03:00");
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function daysSinceISO(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function onlyDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Registra um evento na timeline da implantação. */
async function logImplantacaoEvent(params: {
  implantacao_id: string;
  tipo: string;
  descricao: string;
  metadata?: Record<string, any>;
  autor_id?: string | null;
  autor_nome?: string | null;
}) {
  try {
    await supabase.from("implantacao_eventos").insert({
      implantacao_id: params.implantacao_id,
      tipo: params.tipo,
      descricao: params.descricao,
      metadata: params.metadata ?? {},
      autor_id: params.autor_id ?? null,
      autor_nome: params.autor_nome ?? null,
    });
  } catch {
    // silencioso — não interrompe a ação principal
  }
}

function useStages(userId: string | null) {
  const { data: configs } = useQuery({
    queryKey: ["impl-stage-configs", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("implantacao_stage_configs")
        .select("*")
        .eq("user_id", userId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  return useMemo(() => {
    const cfgByKey = new Map<string, any>();
    (configs ?? []).forEach((c: any) => cfgByKey.set(c.stage_key, c));

    const merged: { key: string; label: string; tone: any; hidden: boolean; isCustom: boolean; ordem: number }[] = [];

    DEFAULT_STAGES.forEach((s, idx) => {
      const c = cfgByKey.get(s.key);
      merged.push({
        key: s.key,
        label: c?.label ?? s.label,
        tone: s.tone,
        hidden: c?.hidden ?? false,
        isCustom: false,
        ordem: c?.ordem ?? idx,
      });
    });

    (configs ?? []).filter((c: any) => c.is_custom).forEach((c: any) => {
      merged.push({
        key: c.stage_key,
        label: c.label,
        tone: "neutral",
        hidden: c.hidden,
        isCustom: true,
        ordem: c.ordem ?? 999,
      });
    });

    merged.sort((a, b) => a.ordem - b.ordem);
    return merged;
  }, [configs]);
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function Implantacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [openCustomize, setOpenCustomize] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const stages = useStages(user?.id ?? null);
  const visibleStages = stages.filter((s) => !s.hidden);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 md:p-6">
      {/* Header (fixo) */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Implantação</h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            Onboarding de novos clientes com checklist e mensagens prontas para WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setOpenCustomize(true)}>
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Personalizar etapas</span>
            <span className="sm:hidden">Etapas</span>
          </Button>
          <Button size="sm" onClick={() => setOpenNew(true)} className="h-9 bg-gradient-brand text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Cliente</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Kanban (preenche restante) */}
      <div className="min-h-0 flex-1">
        <ImplantacaoKanban
          stages={visibleStages}
          onOpenCard={(id) => setEditingId(id)}
          userId={user?.id ?? null}
          userName={user?.user_metadata?.full_name ?? user?.email ?? null}
        />
      </div>

      <NewImplantacaoDialog
        open={openNew}
        onOpenChange={setOpenNew}
        userId={user?.id ?? null}
        qc={qc}
        firstStageKey={visibleStages[0]?.key ?? "novo_cliente"}
      />

      <EditImplantacaoDialog
        implantacaoId={editingId}
        onClose={() => setEditingId(null)}
        stages={visibleStages}
      />

      <CustomizeStagesDialog
        open={openCustomize}
        onOpenChange={setOpenCustomize}
        userId={user?.id ?? null}
        stages={stages}
      />
    </div>
  );
}

// ============================================================
// KANBAN
// ============================================================

function ImplantacaoKanban({
  stages,
  onOpenCard,
  userId,
  userName,
}: {
  stages: { key: string; label: string; tone: any }[];
  onOpenCard: (id: string) => void;
  userId: string | null;
  userName: string | null;
}) {
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["implantacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("*, responsavel:profiles!responsavel_id(full_name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: checklist } = useQuery({
    queryKey: ["checklist-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("implantacao_id, concluido");
      if (error) throw error;
      return data ?? [];
    },
  });

  // última atividade por implantação (a partir dos eventos)
  const { data: lastActs } = useQuery({
    queryKey: ["impl-last-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_eventos")
        .select("implantacao_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lastActMap = useMemo(() => {
    const m = new Map<string, string>();
    (lastActs ?? []).forEach((e: any) => {
      if (!m.has(e.implantacao_id)) m.set(e.implantacao_id, e.created_at);
    });
    return m;
  }, [lastActs]);

  const counts = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    (checklist ?? []).forEach((c: any) => {
      const cur = m.get(c.implantacao_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (c.concluido) cur.done += 1;
      m.set(c.implantacao_id, cur);
    });
    return m;
  }, [checklist]);

  const moveStage = useMutation({
    mutationFn: async ({ id, etapa, fromEtapa, item }: { id: string; etapa: string; fromEtapa: string; item: any }) => {
      const { error } = await supabase.from("implantacoes").update({ etapa: etapa as any }).eq("id", id);
      if (error) throw error;
      const fromLabel = stages.find((s) => s.key === fromEtapa)?.label ?? DEFAULT_STAGE_LABEL[fromEtapa] ?? fromEtapa;
      const toLabel = stages.find((s) => s.key === etapa)?.label ?? DEFAULT_STAGE_LABEL[etapa] ?? etapa;
      await logImplantacaoEvent({
        implantacao_id: id,
        tipo: "mudanca_etapa",
        descricao: `Movido de "${fromLabel}" para "${toLabel}"`,
        metadata: { from: fromEtapa, to: etapa },
        autor_id: userId,
        autor_nome: userName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-last-activity"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeImpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("implantacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["checklist-counts"] });
      toast.success("Implantação removida.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    stages.forEach((s) => (map[s.key] = []));
    (items ?? []).forEach((i: any) => {
      if (map[i.etapa]) map[i.etapa].push(i);
      else if (stages[0]) map[stages[0].key].push(i);
    });
    return map;
  }, [items, stages]);

  // mapa de cor da barra superior por tom da etapa (estilo Pipedrive)
  const stripeByTone: Record<string, string> = {
    info: "bg-info",
    warning: "bg-warning",
    muted: "bg-muted-foreground/40",
    success: "bg-success",
    neutral: "bg-muted-foreground/40",
    primary: "bg-primary",
    accent: "bg-accent",
  };

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="scrollbar-none h-full w-full overflow-x-auto overflow-y-hidden">
      <div className="flex h-full min-w-max gap-3 pb-1">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className="flex h-full min-h-0 w-[15rem] shrink-0 flex-col rounded-lg bg-surface-muted/60"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (!id) return;
              const found = (items ?? []).find((x: any) => x.id === id);
              if (!found || found.etapa === stage.key) return;
              moveStage.mutate({ id, etapa: stage.key, fromEtapa: found.etapa, item: found });
            }}
          >
            {/* Barra colorida fina (3px) */}
            <div className={cn("h-[3px] w-full rounded-t-lg", stripeByTone[stage.tone] ?? "bg-muted-foreground/40")} />
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2 px-3 pb-2 pt-2.5">
              <h3
                className="line-clamp-2 text-[11px] font-semibold uppercase tracking-wide leading-tight text-foreground/80"
                title={stage.label}
              >
                {stage.label}
              </h3>
              <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                {grouped[stage.key]?.length ?? 0}
              </span>
            </div>
            {/* Cards (scroll fino) */}
            <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {(!grouped[stage.key] || grouped[stage.key].length === 0) && (
                <p className="px-2 py-6 text-center text-[11px] text-muted-foreground/70">vazio</p>
              )}
              {(grouped[stage.key] ?? []).map((it: any) => (
                <KanbanCard
                  key={it.id}
                  item={it}
                  count={counts.get(it.id) ?? { done: 0, total: 0 }}
                  lastActivity={lastActMap.get(it.id) ?? null}
                  onClick={() => onOpenCard(it.id)}
                  onDelete={() => {
                    if (confirm(`Excluir a implantação "${it.client_name}"? Os itens de checklist serão removidos.`)) {
                      removeImpl.mutate(it.id);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  item, count, lastActivity, onClick, onDelete,
}: { item: any; count: { done: number; total: number }; lastActivity: string | null; onClick: () => void; onDelete: () => void }) {
  const days = daysSince(item.data_inicio);
  const overdue = days !== null && days > 15;
  const pct = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
  const respName = item.responsavel?.full_name ?? "—";

  // última atividade: usa eventos; se não houver nenhum, cai pra updated_at
  const lastIso = lastActivity ?? item.updated_at ?? item.created_at;
  const lastDays = daysSinceISO(lastIso);
  const stale = lastDays !== null && lastDays > 7;

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="group relative cursor-pointer rounded-md border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/40"
    >
      <Button
        size="icon"
        variant="ghost"
        aria-label="Excluir implantação"
        className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/60" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate pr-6 text-sm font-semibold">{item.client_name}</p>

          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-gradient-brand text-[9px] text-primary-foreground">
                {initials(respName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-[11px] text-muted-foreground">{respName}</span>
          </div>

          <div className="space-y-1">
            <Progress value={pct} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">
              {count.done}/{count.total} — {pct}%
            </p>
          </div>

          {/* Última atividade */}
          {lastDays !== null && (
            stale ? (
              <p className="flex items-center gap-1 text-[10px] font-medium text-warning">
                <AlertCircle className="h-3 w-3" />
                Sem atividade há {lastDays} {lastDays === 1 ? "dia" : "dias"}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Última atividade: {lastDays === 0 ? "hoje" : `há ${lastDays} ${lastDays === 1 ? "dia" : "dias"}`}
              </p>
            )
          )}

          {days !== null && (
            <p className={cn("text-[10px]", overdue ? "font-medium text-warning" : "text-muted-foreground")}>
              {days} {days === 1 ? "dia" : "dias"} em andamento
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL: NOVA IMPLANTAÇÃO
// ============================================================

function NewImplantacaoDialog({
  open, onOpenChange, userId, qc, firstStageKey,
}: { open: boolean; onOpenChange: (v: boolean) => void; userId: string | null; qc: any; firstStageKey: string }) {
  const [form, setForm] = useState({
    client_id: "",
    client_name: "",
    cnpj: "",
    produto: "",
    contato_cliente: "",
    telefone_cliente: "",
    email_cliente: "",
    data_inicio: "",
    data_go_live: "",
    responsavel_id: "",
    observacoes: "",
  });
  const [clientSearch, setClientSearch] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, cnpj, email, phone, whatsapp, contact_name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return (clients ?? []).filter((c: any) =>
      [c.name, c.company, c.cnpj].filter(Boolean).some((v: string) => v.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [clients, clientSearch]);

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Não autenticado");
      const { data: created, error } = await supabase.from("implantacoes").insert({
        client_id: form.client_id || null,
        client_name: form.client_name.trim(),
        cnpj: form.cnpj || null,
        produto: form.produto || null,
        contato_cliente: form.contato_cliente || null,
        telefone_cliente: form.telefone_cliente || null,
        email_cliente: form.email_cliente || null,
        etapa: firstStageKey as any,
        data_inicio: form.data_inicio || null,
        data_go_live: form.data_go_live || null,
        responsavel_id: form.responsavel_id || null,
        observacoes: form.observacoes || null,
        created_by: userId,
      }).select("id").single();
      if (error) throw error;

      const seedRows: any[] = [];
      (Object.keys(DEFAULT_CHECKLIST) as StageKey[]).forEach((etapa) => {
        DEFAULT_CHECKLIST[etapa].forEach((label, idx) => {
          seedRows.push({ implantacao_id: created!.id, etapa, label, ordem: idx });
        });
      });
      if (seedRows.length) {
        await supabase.from("checklist_items").insert(seedRows);
      }

      await logImplantacaoEvent({
        implantacao_id: created!.id,
        tipo: "mudanca_etapa",
        descricao: `Implantação criada na etapa "${DEFAULT_STAGE_LABEL[firstStageKey] ?? firstStageKey}"`,
        metadata: { to: firstStageKey, criacao: true },
        autor_id: userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["checklist-counts"] });
      qc.invalidateQueries({ queryKey: ["impl-last-activity"] });
      toast.success("Implantação criada.");
      onOpenChange(false);
      setForm({
        client_id: "", client_name: "", cnpj: "", produto: "", contato_cliente: "",
        telefone_cliente: "", email_cliente: "", data_inicio: "", data_go_live: "",
        responsavel_id: "", observacoes: "",
      });
      setClientSearch("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pickClient = (c: any) => {
    setForm({
      ...form,
      client_id: c.id,
      client_name: c.company || c.name || "",
      cnpj: c.cnpj || "",
      email_cliente: c.email || "",
      telefone_cliente: c.whatsapp || c.phone || "",
      contato_cliente: c.contact_name || "",
    });
    setClientSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova implantação</DialogTitle>
          <DialogDescription>Comece um novo onboarding. Você poderá editar checklist e enviar mensagens depois.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); if (!form.client_name.trim()) return toast.error("Informe a empresa."); create.mutate(); }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label className="text-xs">Buscar cliente da carteira</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Digite o nome, razão social ou CNPJ…"
                className="h-9 pl-8"
              />
              {clientSearch && filteredClients.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                  {filteredClients.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickClient(c)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="truncate">
                        <strong>{c.company || c.name}</strong>
                        {c.cnpj && <span className="ml-1 text-xs text-muted-foreground">· {c.cnpj}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.client_id && (
              <p className="text-[11px] text-success">✓ Cliente vinculado da carteira.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldText label="Razão Social / Empresa *" value={form.client_name} onChange={(v) => setForm({ ...form, client_name: v })} required />
            <FieldText label="CNPJ" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Select value={form.produto || "none"} onValueChange={(v) => setForm({ ...form, produto: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Produto…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PRODUTOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FieldText label="Contato no cliente" value={form.contato_cliente} onChange={(v) => setForm({ ...form, contato_cliente: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldText label="Telefone / WhatsApp" value={form.telefone_cliente} onChange={(v) => setForm({ ...form, telefone_cliente: v })} placeholder="(11) 91234-5678" />
            <FieldText label="E-mail do cliente" value={form.email_cliente} onChange={(v) => setForm({ ...form, email_cliente: v })} type="email" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldText label="Data de início" value={form.data_inicio} onChange={(v) => setForm({ ...form, data_inicio: v })} type="date" />
            <FieldText label="Previsão de conclusão" value={form.data_go_live} onChange={(v) => setForm({ ...form, data_go_live: v })} type="date" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Responsável interno</Label>
            <Select value={form.responsavel_id || "none"} onValueChange={(v) => setForm({ ...form, responsavel_id: v === "none" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">— Não atribuído —</SelectItem>
                {(profiles ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações internas</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Não é visível ao cliente" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldText({
  label, value, onChange, type = "text", placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="h-9" />
    </div>
  );
}

// ============================================================
// MODAL: EDITAR (4 abas)
// ============================================================

function EditImplantacaoDialog({
  implantacaoId, onClose, stages,
}: { implantacaoId: string | null; onClose: () => void; stages: { key: string; label: string; tone: any }[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name ?? user?.email ?? null;
  const [tab, setTab] = useState("dados");

  const { data: item } = useQuery({
    queryKey: ["implantacao", implantacaoId],
    queryFn: async () => {
      if (!implantacaoId) return null;
      const { data, error } = await supabase
        .from("implantacoes")
        .select("*, responsavel:profiles!responsavel_id(full_name, avatar_url)")
        .eq("id", implantacaoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!implantacaoId,
  });

  const { data: checklist } = useQuery({
    queryKey: ["checklist", implantacaoId],
    queryFn: async () => {
      if (!implantacaoId) return [];
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("implantacao_id", implantacaoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!implantacaoId,
  });

  const totals = useMemo(() => {
    const total = (checklist ?? []).length;
    const done = (checklist ?? []).filter((c: any) => c.concluido).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [checklist]);

  const stageLabel = stages.find((s) => s.key === item?.etapa)?.label ?? item?.etapa;

  return (
    <Dialog open={!!implantacaoId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{item.client_name}</DialogTitle>
              <DialogDescription>
                Etapa atual: <span className="font-medium text-foreground">{stageLabel}</span>
                {item.produto && <> · {PRODUTO_LABEL[item.produto] ?? item.produto}</>}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border border-border bg-surface-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Progresso do checklist</span>
                <span className="text-muted-foreground">{totals.done}/{totals.total} — {totals.pct}%</span>
              </div>
              <Progress value={totals.pct} className="h-2" />
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                <span>Início: <span className="text-foreground">{item.data_inicio ? formatBrazilDate(item.data_inicio) : "—"}</span></span>
                <span>Previsão: <span className="text-foreground">{item.data_go_live ? formatBrazilDate(item.data_go_live) : "—"}</span></span>
                {item.cnpj && <span>CNPJ: <span className="text-foreground">{formatCnpj(item.cnpj)}</span></span>}
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
                <TabsTrigger value="checklist" className="flex-1">Checklist</TabsTrigger>
                <TabsTrigger value="mensagens" className="flex-1">Mensagens</TabsTrigger>
                <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="mt-3">
                <DadosTab item={item} qc={qc} stages={stages} onClose={onClose} userId={user?.id ?? null} userName={userName} />
              </TabsContent>

              <TabsContent value="checklist" className="mt-3">
                <ChecklistTab item={item} stages={stages} items={checklist ?? []} qc={qc} userId={user?.id ?? null} userName={userName} />
              </TabsContent>

              <TabsContent value="mensagens" className="mt-3">
                <MensagensTab item={item} qc={qc} userId={user?.id ?? null} userName={userName} />
              </TabsContent>

              <TabsContent value="historico" className="mt-3">
                <HistoricoTab implantacaoId={item.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// -------- ABA DADOS --------

function DadosTab({
  item, qc, stages, onClose, userId, userName,
}: { item: any; qc: any; stages: { key: string; label: string }[]; onClose: () => void; userId: string | null; userName: string | null }) {
  const [form, setForm] = useState({
    client_name: item.client_name ?? "",
    cnpj: item.cnpj ?? "",
    produto: item.produto ?? "",
    metodo_registro: item.metodo_registro ?? "",
    metodo_registro_obs: item.metodo_registro_obs ?? "",
    contato_cliente: item.contato_cliente ?? "",
    telefone_cliente: item.telefone_cliente ?? "",
    email_cliente: item.email_cliente ?? "",
    etapa: item.etapa,
    data_inicio: item.data_inicio ?? "",
    data_go_live: item.data_go_live ?? "",
    responsavel_id: item.responsavel_id ?? "",
    observacoes: item.observacoes ?? "",
    gravacao_t1: item.gravacao_t1 ?? "",
    transcricao_t1: item.transcricao_t1 ?? "",
    gravacao_t2: item.gravacao_t2 ?? "",
    transcricao_t2: item.transcricao_t2 ?? "",
    gravacao_t3: item.gravacao_t3 ?? "",
    transcricao_t3: item.transcricao_t3 ?? "",
  });

  useEffect(() => {
    setForm({
      client_name: item.client_name ?? "",
      cnpj: item.cnpj ?? "",
      produto: item.produto ?? "",
      metodo_registro: item.metodo_registro ?? "",
      metodo_registro_obs: item.metodo_registro_obs ?? "",
      contato_cliente: item.contato_cliente ?? "",
      telefone_cliente: item.telefone_cliente ?? "",
      email_cliente: item.email_cliente ?? "",
      etapa: item.etapa,
      data_inicio: item.data_inicio ?? "",
      data_go_live: item.data_go_live ?? "",
      responsavel_id: item.responsavel_id ?? "",
      observacoes: item.observacoes ?? "",
      gravacao_t1: item.gravacao_t1 ?? "",
      transcricao_t1: item.transcricao_t1 ?? "",
      gravacao_t2: item.gravacao_t2 ?? "",
      transcricao_t2: item.transcricao_t2 ?? "",
      gravacao_t3: item.gravacao_t3 ?? "",
      transcricao_t3: item.transcricao_t3 ?? "",
    });
  }, [item.id]);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      const stageChanged = form.etapa !== item.etapa;
      const { error } = await supabase.from("implantacoes").update({
        client_name: form.client_name.trim(),
        cnpj: form.cnpj || null,
        produto: form.produto || null,
        metodo_registro: form.metodo_registro || null,
        metodo_registro_obs: form.metodo_registro_obs || null,
        contato_cliente: form.contato_cliente || null,
        telefone_cliente: form.telefone_cliente || null,
        email_cliente: form.email_cliente || null,
        etapa: form.etapa as any,
        data_inicio: form.data_inicio || null,
        data_go_live: form.data_go_live || null,
        responsavel_id: form.responsavel_id || null,
        observacoes: form.observacoes || null,
        gravacao_t1: form.gravacao_t1 || null,
        transcricao_t1: form.transcricao_t1 || null,
        gravacao_t2: form.gravacao_t2 || null,
        transcricao_t2: form.transcricao_t2 || null,
        gravacao_t3: form.gravacao_t3 || null,
        transcricao_t3: form.transcricao_t3 || null,
      } as any).eq("id", item.id);
      if (error) throw error;

      if (stageChanged) {
        const fromLabel = stages.find((s) => s.key === item.etapa)?.label ?? item.etapa;
        const toLabel = stages.find((s) => s.key === form.etapa)?.label ?? form.etapa;
        await logImplantacaoEvent({
          implantacao_id: item.id,
          tipo: "mudanca_etapa",
          descricao: `Movido de "${fromLabel}" para "${toLabel}"`,
          metadata: { from: item.etapa, to: form.etapa },
          autor_id: userId,
          autor_nome: userName,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["implantacao", item.id] });
      qc.invalidateQueries({ queryKey: ["impl-eventos", item.id] });
      qc.invalidateQueries({ queryKey: ["impl-last-activity"] });
      toast.success("Atualizado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("implantacoes").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["checklist-counts"] });
      toast.success("Implantação removida.");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <FieldText label="Razão Social / Empresa *" value={form.client_name} onChange={(v) => setForm({ ...form, client_name: v })} required />
        <FieldText label="CNPJ" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Produto</Label>
          <Select value={form.produto || "none"} onValueChange={(v) => setForm({ ...form, produto: v === "none" ? "" : v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Produto…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {PRODUTOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Etapa</Label>
          <Select value={form.etapa} onValueChange={(v) => setForm({ ...form, etapa: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Método de registro de ponto */}
      <MetodoRegistroField
        value={form.metodo_registro}
        obs={form.metodo_registro_obs}
        onChange={(v) => setForm({ ...form, metodo_registro: v })}
        onObsChange={(v) => setForm({ ...form, metodo_registro_obs: v })}
      />

      <div className="grid grid-cols-2 gap-3">
        <FieldText label="Contato no cliente" value={form.contato_cliente} onChange={(v) => setForm({ ...form, contato_cliente: v })} />
        <FieldText label="Telefone / WhatsApp" value={form.telefone_cliente} onChange={(v) => setForm({ ...form, telefone_cliente: v })} />
      </div>
      <FieldText label="E-mail do cliente" value={form.email_cliente} onChange={(v) => setForm({ ...form, email_cliente: v })} type="email" />
      <div className="grid grid-cols-2 gap-3">
        <FieldText label="Data de início" value={form.data_inicio} onChange={(v) => setForm({ ...form, data_inicio: v })} type="date" />
        <FieldText label="Previsão de conclusão" value={form.data_go_live} onChange={(v) => setForm({ ...form, data_go_live: v })} type="date" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Responsável interno</Label>
        <Select value={form.responsavel_id || "none"} onValueChange={(v) => setForm({ ...form, responsavel_id: v === "none" ? "" : v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent className="max-h-[260px]">
            <SelectItem value="none">— Não atribuído —</SelectItem>
            {(profiles ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Observações internas</Label>
        <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
      </div>


      {/* Gravações dos treinamentos */}
      <div className="rounded-md border border-border bg-surface-muted/30 p-3 space-y-3">
        <div>
          <p className="text-sm font-medium">Gravações dos treinamentos</p>
          <p className="text-[11px] text-muted-foreground">Cole links de Google Drive, YouTube, Notion, etc. (opcional)</p>
        </div>
        {[
          { key: "t1", label: "Treinamento 1 — Parametrização" },
          { key: "t2", label: "Treinamento 2 — Menus" },
          { key: "t3", label: "Treinamento 3 — Fechamento" },
        ].map((t) => {
          const gravKey = `gravacao_${t.key}` as keyof typeof form;
          const transcKey = `transcricao_${t.key}` as keyof typeof form;
          return (
            <div key={t.key} className="space-y-1">
              <p className="text-xs font-medium">{t.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <UrlField
                  placeholder="Link da gravação"
                  value={form[gravKey] as string}
                  onChange={(v) => setForm({ ...form, [gravKey]: v })}
                />
                <UrlField
                  placeholder="Link da transcrição"
                  value={form[transcKey] as string}
                  onChange={(v) => setForm({ ...form, [transcKey]: v })}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Links úteis */}
      <div className="rounded-md border border-border bg-info/5 p-3 space-y-2">
        <p className="text-sm font-medium">Links úteis</p>
        <ul className="space-y-1.5 text-xs">
          {[
            { label: "Central de Ajuda VR", href: "https://materiais.vr.com.br/central-de-ajuda/" },
            { label: "Tutorial colaborador (SuperApp VR)", href: "https://www.youtube.com/watch?v=nG_s2MJDshc&t=38s" },
            { label: "Agendamento Treinamento 1", href: "https://vempraponto.pipedrive.com/scheduler/qlapKRSp/treinamento-1-parametrizacao" },
          ].map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-info hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between pt-2 sticky bottom-0 bg-background pb-1">
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => {
          if (confirm("Excluir esta implantação? Os itens de checklist serão removidos.")) remove.mutate();
        }}>
          <Trash2 className="h-4 w-4" /> Excluir
        </Button>
        <Button type="submit" disabled={update.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

function UrlField({
  placeholder, value, onChange,
}: { placeholder: string; value: string; onChange: (v: string) => void }) {
  const valid = value && /^https?:\/\//i.test(value);
  return (
    <div className="relative">
      <Input
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pr-9"
      />
      {valid && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir em nova aba"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

const METODO_REGISTRO_OPTS: { value: string; label: string; hint: string }[] = [
  { value: "rep",         label: "REP (tablet/totem fixo)", hint: "Indicado para construção civil, fábricas, recepções — evita fraudes." },
  { value: "superapp_vr", label: "SuperApp VR (mobile)",     hint: "Indicado para externos e home office." },
  { value: "ponto_web",   label: "Ponto Web (navegador)",    hint: "Indicado para escritório." },
  { value: "whatsapp",    label: "WhatsApp",                  hint: "Indicado para operacionais sem acesso a e-mail." },
];

function MetodoRegistroField({
  value, obs, onChange, onObsChange,
}: { value: string; obs: string; onChange: (v: string) => void; onObsChange: (v: string) => void }) {
  const selected = new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  function toggle(opt: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(opt);
    else next.delete(opt);
    onChange(Array.from(next).join(","));
  }

  return (
    <div className="rounded-md border border-border bg-surface-muted/30 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">Método de registro de ponto</p>
        <p className="text-[11px] text-muted-foreground">Pode marcar mais de um método.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {METODO_REGISTRO_OPTS.map((opt) => {
          const checked = selected.has(opt.value);
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors",
                checked ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/40"
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => toggle(opt.value, !!v)}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-medium leading-tight">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{opt.hint}</p>
              </div>
            </label>
          );
        })}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Observação sobre o método escolhido</Label>
        <Textarea
          rows={2}
          value={obs}
          onChange={(e) => onObsChange(e.target.value)}
          placeholder="Ex: cliente optou pelo REP pois tem equipe de construção civil — risco de fraude com app mobile"
          className="bg-background"
        />
      </div>
    </div>
  );
}

// -------- ABA CHECKLIST --------

function ChecklistTab({
  item, stages, items, qc, userId, userName,
}: { item: any; stages: { key: string; label: string }[]; items: any[]; qc: any; userId: string | null; userName: string | null }) {
  const [newLabel, setNewLabel] = useState("");
  const stageItems = items.filter((i) => i.etapa === item.etapa);
  const stageLabel = stages.find((s) => s.key === item.etapa)?.label ?? item.etapa;
  const done = stageItems.filter((i) => i.concluido).length;
  const total = stageItems.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Auto-seed: se a etapa é padrão e ainda não tem nenhum item, popula com o checklist sugerido.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    setSeeded(false);
  }, [item.id, item.etapa]);
  useEffect(() => {
    if (seeded) return;
    if (!items) return; // espera dados carregarem
    if (stageItems.length > 0) return;
    const defaults = DEFAULT_CHECKLIST[item.etapa as StageKey];
    if (!defaults || defaults.length === 0) return;
    setSeeded(true);
    (async () => {
      const rows = defaults.map((label, idx) => ({
        implantacao_id: item.id,
        etapa: item.etapa,
        label,
        ordem: idx,
      }));
      const { error } = await supabase.from("checklist_items").insert(rows);
      if (!error) {
        qc.invalidateQueries({ queryKey: ["checklist", item.id] });
        qc.invalidateQueries({ queryKey: ["checklist-counts"] });
      }
    })();
  }, [seeded, items, stageItems.length, item.id, item.etapa, qc]);

  // Pendência da etapa atual
  const { data: pendencia } = useQuery({
    queryKey: ["impl-pendencia", item.id, item.etapa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_pendencias")
        .select("*")
        .eq("implantacao_id", item.id)
        .eq("etapa", item.etapa)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [pendenciaText, setPendenciaText] = useState("");
  useEffect(() => {
    setPendenciaText(pendencia?.conteudo ?? "");
  }, [pendencia?.id, item.etapa]);

  const savePendencia = useMutation({
    mutationFn: async () => {
      const conteudo = pendenciaText.trim();
      const previousConteudo = (pendencia?.conteudo ?? "").trim();
      if (conteudo === previousConteudo) return;

      const { error } = await supabase
        .from("implantacao_pendencias")
        .upsert(
          {
            implantacao_id: item.id,
            etapa: item.etapa,
            conteudo,
            updated_by: userId,
          },
          { onConflict: "implantacao_id,etapa" }
        );
      if (error) throw error;

      if (conteudo) {
        await logImplantacaoEvent({
          implantacao_id: item.id,
          tipo: "pendencia",
          descricao: `Pendência registrada em "${stageLabel}": ${conteudo.slice(0, 120)}${conteudo.length > 120 ? "…" : ""}`,
          metadata: { etapa: item.etapa },
          autor_id: userId,
          autor_nome: userName,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-pendencia", item.id, item.etapa] });
      qc.invalidateQueries({ queryKey: ["impl-eventos", item.id] });
      qc.invalidateQueries({ queryKey: ["impl-last-activity"] });
      toast.success("Pendências salvas.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluido, label }: { id: string; concluido: boolean; label: string }) => {
      const { error } = await supabase.from("checklist_items").update({ concluido }).eq("id", id);
      if (error) throw error;
      await logImplantacaoEvent({
        implantacao_id: item.id,
        tipo: concluido ? "checklist_concluido" : "checklist_desmarcado",
        descricao: concluido
          ? `✓ "${label}" concluído em "${stageLabel}"`
          : `Desmarcado: "${label}" em "${stageLabel}"`,
        metadata: { etapa: item.etapa, item_id: id },
        autor_id: userId,
        autor_nome: userName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", item.id] });
      qc.invalidateQueries({ queryKey: ["checklist-counts"] });
      qc.invalidateQueries({ queryKey: ["impl-eventos", item.id] });
      qc.invalidateQueries({ queryKey: ["impl-last-activity"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase.from("checklist_items").insert({
        implantacao_id: item.id,
        etapa: item.etapa,
        label,
        ordem: total,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", item.id] });
      qc.invalidateQueries({ queryKey: ["checklist-counts"] });
      setNewLabel("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", item.id] });
      qc.invalidateQueries({ queryKey: ["checklist-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="rounded-md border border-border bg-surface-muted/40 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Etapa: {stageLabel}</span>
          <span className="text-muted-foreground">{done}/{total} — {pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="space-y-1.5">
        {stageItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-surface-muted/30 p-4 text-center text-sm text-muted-foreground">
            Nenhum item de checklist para esta etapa. Adicione abaixo.
          </p>
        ) : (
          stageItems.map((it) => {
            const before = warningBeforeLabel(it.label);
            return (
              <div key={it.id} className="space-y-1.5">
                {before}
                <div className="group flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                  <Checkbox
                    checked={it.concluido}
                    onCheckedChange={(v) => toggle.mutate({ id: it.id, concluido: !!v, label: it.label })}
                  />
                  <span className={cn("flex-1 text-sm", it.concluido && "line-through text-muted-foreground")}>
                    {renderLabelWithLink(it.label)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem.mutate(it.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (newLabel.trim()) addItem.mutate(newLabel.trim()); }}
        className="flex gap-2"
      >
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Novo item de checklist…"
          className="h-9"
        />
        <Button type="submit" disabled={!newLabel.trim() || addItem.isPending} className="h-9">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </form>

      {/* Pendências da etapa */}
      <div className="rounded-md border border-border bg-warning/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium">Pendências / Observações desta etapa</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            disabled={savePendencia.isPending}
            onClick={() => savePendencia.mutate()}
          >
            {savePendencia.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Salvar pendências
          </Button>
        </div>
        <Textarea
          rows={3}
          value={pendenciaText}
          onChange={(e) => setPendenciaText(e.target.value)}
          placeholder="O que ficou faltando ou precisa de atenção nesta etapa?"
          className="bg-background"
        />
      </div>
    </div>
  );
}

// -------- ABA MENSAGENS --------

function MensagensTab({
  item, qc, userId, userName,
}: { item: any; qc: any; userId: string | null; userName: string | null }) {
  const [tplKey, setTplKey] = useState(MESSAGE_TEMPLATES[0].key);
  const tpl = MESSAGE_TEMPLATES.find((t) => t.key === tplKey)!;

  const nome = item.contato_cliente || item.client_name || "";
  const finalText = tpl.body.replace(/\{nome\}/g, nome);

  const phoneDigits = onlyDigits(item.telefone_cliente);
  const hasPhone = phoneDigits.length >= 8;
  const waNumber = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

  const logMessage = async (action: "copiada" | "enviada") => {
    await logImplantacaoEvent({
      implantacao_id: item.id,
      tipo: "mensagem",
      descricao: `📱 Mensagem "${tpl.title}" ${action}`,
      metadata: { template: tpl.key, action },
      autor_id: userId,
      autor_nome: userName,
    });
    qc.invalidateQueries({ queryKey: ["impl-eventos", item.id] });
    qc.invalidateQueries({ queryKey: ["impl-last-activity"] });
  };

  const copy = async () => {
    navigator.clipboard.writeText(finalText);
    toast.success("Mensagem copiada.");
    await logMessage("copiada");
  };

  const openWhats = async () => {
    if (!hasPhone) return;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(finalText)}`, "_blank");
    await logMessage("enviada");
  };

  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="space-y-1">
        <Label className="text-xs">Template</Label>
        <Select value={tplKey} onValueChange={setTplKey}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESSAGE_TEMPLATES.map((t) => <SelectItem key={t.key} value={t.key}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Preview</Label>
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-info/5 p-3 font-mono text-[13px] leading-relaxed">
          {finalText}
        </pre>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={copy}>
          <Copy className="h-4 w-4" /> Copiar mensagem
        </Button>
        {hasPhone ? (
          <Button onClick={openWhats} className="bg-success text-success-foreground hover:bg-success/90">
            <Send className="h-4 w-4" /> Abrir no WhatsApp
          </Button>
        ) : (
          <p className="text-[11px] text-warning">
            Cadastre o telefone na aba Dados para habilitar o envio.
          </p>
        )}
      </div>
    </div>
  );
}

// -------- ABA HISTÓRICO --------

function HistoricoTab({ implantacaoId }: { implantacaoId: string }) {
  const { data: eventos, isLoading } = useQuery({
    queryKey: ["impl-eventos", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_eventos")
        .select("*")
        .eq("implantacao_id", implantacaoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const iconFor = (tipo: string) => {
    switch (tipo) {
      case "mudanca_etapa": return <ArrowRightLeft className="h-3.5 w-3.5 text-info" />;
      case "checklist_concluido": return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case "checklist_desmarcado": return <X className="h-3.5 w-3.5 text-muted-foreground" />;
      case "mensagem": return <MessageSquare className="h-3.5 w-3.5 text-primary" />;
      case "anotacao": return <StickyNote className="h-3.5 w-3.5 text-warning" />;
      case "pendencia": return <AlertCircle className="h-3.5 w-3.5 text-warning" />;
      default: return <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!eventos || eventos.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-surface-muted/30 p-6 text-center text-sm text-muted-foreground">
        Ainda não há eventos registrados para esta implantação.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
      {eventos.map((ev: any) => (
        <div key={ev.id} className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2">
          <div className="mt-0.5 shrink-0">{iconFor(ev.tipo)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">{ev.descricao}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatBrazilDateTime(ev.created_at)}
              {ev.autor_nome && <> · {ev.autor_nome}</>}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MODAL: PERSONALIZAR ETAPAS
// ============================================================

function CustomizeStagesDialog({
  open, onOpenChange, userId, stages,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; userId: string | null;
  stages: { key: string; label: string; hidden: boolean; isCustom: boolean; ordem: number }[];
}) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<{ key: string; label: string; hidden: boolean; isCustom: boolean; ordem: number }[]>([]);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (open) setDrafts(stages.map((s) => ({ ...s })));
  }, [open, stages]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Não autenticado");
      const rows = drafts.map((d) => ({
        user_id: userId,
        stage_key: d.key,
        label: d.label,
        hidden: d.hidden,
        is_custom: d.isCustom,
        ordem: d.ordem,
      }));
      const { error } = await supabase
        .from("implantacao_stage_configs")
        .upsert(rows, { onConflict: "user_id,stage_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-stage-configs", userId] });
      toast.success("Etapas atualizadas.");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeCustom = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!userId) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("implantacao_stage_configs")
        .delete()
        .eq("user_id", userId)
        .eq("stage_key", stageKey);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-stage-configs", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCustom = () => {
    if (!newLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    setDrafts([...drafts, {
      key, label: newLabel.trim(), hidden: false, isCustom: true, ordem: drafts.length,
    }]);
    setNewLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Personalizar etapas</DialogTitle>
          <DialogDescription>Renomeie, oculte ou crie etapas customizadas. Suas configurações são individuais.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {drafts.map((d, idx) => (
            <div key={d.key} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
              <Input
                value={d.label}
                onChange={(e) => {
                  const next = [...drafts];
                  next[idx] = { ...d, label: e.target.value };
                  setDrafts(next);
                }}
                className="h-8"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <Switch
                  checked={!d.hidden}
                  onCheckedChange={(v) => {
                    const next = [...drafts];
                    next[idx] = { ...d, hidden: !v };
                    setDrafts(next);
                  }}
                />
                {d.hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              {d.isCustom ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setDrafts(drafts.filter((x) => x.key !== d.key));
                    if (!d.key.startsWith("custom_")) {
                      removeCustom.mutate(d.key);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <ToneBadge tone="muted" size="sm">padrão</ToneBadge>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); addCustom(); }}
          className="flex gap-2 border-t border-border pt-3"
        >
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nome da nova etapa…"
            className="h-9"
          />
          <Button type="submit" variant="outline" disabled={!newLabel.trim()}>
            <Plus className="h-4 w-4" /> Nova etapa
          </Button>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
