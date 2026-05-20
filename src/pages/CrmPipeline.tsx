import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Bell, Filter, Search } from "lucide-react";
import { CnpjSearchDialog } from "@/components/crm/CnpjSearchDialog";
import { toast } from "sonner";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCorners,
} from "@dnd-kit/core";
import { DealDialog } from "@/components/crm/DealDialog";
import { WinDealDialog } from "@/components/crm/WinDealDialog";
import { LoseDealDialog } from "@/components/crm/LoseDealDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { fmtBRL, ETIQUETA_OPTIONS } from "@/lib/crmOptions";

export type DealStage = "lead" | "contato" | "apresentacao" | "negociacao" | "fechado_ganho" | "fechado_perdido";
export type DealProduct = "vr_beneficios" | "rh_digital" | "ambos";

export interface Deal {
  id: string;
  title: string;
  company_name: string;
  client_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  value: number;
  product: DealProduct | null;
  stage: DealStage;
  expected_close_date: string | null;
  notes: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // novos
  etiqueta?: string | null;
  faixa_colaboradores?: string | null;
  origem_lead?: string | null;
  stage_changed_at?: string | null;
  plano_contratado?: string | null;
  segmento?: string | null;
  estado?: string | null;
  probabilidade?: string | null;
  canal_origem?: string | null;
  fonte_indicacao?: string | null;
  quem_implanta?: string | null;
  extensoes?: string[] | null;
  motivo_perda?: string | null;
}

const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: "lead", label: "Lead", color: "hsl(210 90% 55%)" },
  { key: "contato", label: "Contato", color: "hsl(190 85% 45%)" },
  { key: "apresentacao", label: "Apresentação", color: "hsl(265 75% 60%)" },
  { key: "negociacao", label: "Negociação", color: "hsl(35 95% 55%)" },
  { key: "fechado_ganho", label: "Fechado Ganho", color: "hsl(140 65% 45%)" },
  { key: "fechado_perdido", label: "Fechado Perdido", color: "hsl(0 75% 55%)" },
];

const PRODUCT_LABEL: Record<DealProduct, string> = {
  vr_beneficios: "VR Benefícios",
  rh_digital: "RH Digital",
  ambos: "VR + RH",
};

const daysBetween = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

export default function CrmPipeline() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cnpjDialogOpen, setCnpjDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [winDeal, setWinDeal] = useState<Deal | null>(null);
  const [loseDeal, setLoseDeal] = useState<Deal | null>(null);
  const [mobileStageIdx, setMobileStageIdx] = useState(0);

  // Filtros
  const [fOwner, setFOwner] = useState<string>("todos");
  const [fProduto, setFProduto] = useState<string>("todos");
  const [fEtiqueta, setFEtiqueta] = useState<string>("todos");
  const [fOrigem, setFOrigem] = useState<string>("todos");
  const [fFaixa, setFFaixa] = useState<string>("todos");

  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  // Atividades atrasadas/pendentes por deal
  const { data: pendingActivities = {} } = useQuery({
    queryKey: ["deal-activities-pending-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("deal_id, agendado_para, status")
        .eq("status", "pendente");
      if (error) throw error;
      const map: Record<string, { count: number; overdue: boolean }> = {};
      const now = Date.now();
      (data ?? []).forEach((a: any) => {
        if (!a.deal_id) return;
        const overdue = a.agendado_para && new Date(a.agendado_para).getTime() < now;
        const cur = map[a.deal_id] ?? { count: 0, overdue: false };
        cur.count += 1;
        if (overdue) cur.overdue = true;
        map[a.deal_id] = cur;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (fOwner === "meu" && user && d.owner_id !== user.id && d.created_by !== user.id) return false;
      if (fProduto !== "todos" && d.product !== fProduto) return false;
      if (fEtiqueta !== "todos" && d.etiqueta !== fEtiqueta) return false;
      if (fOrigem !== "todos" && d.origem_lead !== fOrigem) return false;
      if (fFaixa !== "todos" && d.faixa_colaboradores !== fFaixa) return false;
      return true;
    });
  }, [deals, fOwner, fProduto, fEtiqueta, fOrigem, fFaixa, user]);

  const byStage = useMemo(() => {
    const map: Record<DealStage, Deal[]> = {
      lead: [], contato: [], apresentacao: [], negociacao: [], fechado_ganho: [], fechado_perdido: [],
    };
    filtered.forEach((d) => map[d.stage]?.push(d));
    return map;
  }, [filtered]);

  const totals = useMemo(() => {
    const t: Record<DealStage, number> = {
      lead: 0, contato: 0, apresentacao: 0, negociacao: 0, fechado_ganho: 0, fechado_perdido: 0,
    };
    filtered.forEach((d) => { t[d.stage] += Number(d.value || 0); });
    return t;
  }, [filtered]);

  const pipelineActiveTotal = useMemo(
    () => filtered.filter((d) => d.stage !== "fechado_ganho" && d.stage !== "fechado_perdido").reduce((s, d) => s + Number(d.value || 0), 0),
    [filtered],
  );

  const origensDisponiveis = useMemo(() => Array.from(new Set(deals.map((d) => d.origem_lead).filter(Boolean))) as string[], [deals]);
  const faixasDisponiveis = useMemo(() => Array.from(new Set(deals.map((d) => d.faixa_colaboradores).filter(Boolean))) as string[], [deals]);

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: DealStage }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["deals"] });
      const prev = qc.getQueryData<Deal[]>(["deals"]);
      qc.setQueryData<Deal[]>(["deals"], (old) =>
        (old ?? []).map((d) => (d.id === id ? { ...d, stage } : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["deals"], ctx.prev);
      toast.error("Não foi possível mover");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => {
    const d = filtered.find((x) => x.id === e.active.id);
    if (d) setActiveDeal(d);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = e;
    if (!over) return;
    const newStage = over.id as DealStage;
    const deal = filtered.find((d) => d.id === active.id);
    if (!deal || deal.stage === newStage) return;
    if (!STAGES.some((s) => s.key === newStage)) return;
    // Interceptar fechamento
    if (newStage === "fechado_ganho") { setWinDeal(deal); return; }
    if (newStage === "fechado_perdido") { setLoseDeal(deal); return; }
    moveMutation.mutate({ id: deal.id, stage: newStage });
  };

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const u = () => setIsMobile(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);

  const visibleStages = isMobile ? [STAGES[mobileStageIdx]] : STAGES;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Briefcase className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">CRM — Pipeline</h1>
            <p className="text-xs text-muted-foreground">
              Total ativo no pipeline: <span className="font-semibold text-foreground">{fmtBRL(pipelineActiveTotal)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCnpjDialogOpen(true)}>
            <Search className="h-4 w-4" /> Buscar CNPJ
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo Negócio
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-6 py-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <FilterSelect value={fOwner} onChange={setFOwner} placeholder="Responsável" options={[{ value: "todos", label: "Todos" }, { value: "meu", label: "Meu pipeline" }]} />
        <FilterSelect value={fProduto} onChange={setFProduto} placeholder="Produto" options={[{ value: "todos", label: "Todos produtos" }, { value: "rh_digital", label: "RH Digital" }, { value: "vr_beneficios", label: "VR" }, { value: "ambos", label: "Ambos" }]} />
        <FilterSelect value={fEtiqueta} onChange={setFEtiqueta} placeholder="Etiqueta" options={[{ value: "todos", label: "Todas etiquetas" }, ...ETIQUETA_OPTIONS.map((e) => ({ value: e.value, label: `${e.emoji} ${e.label}` }))]} />
        <FilterSelect value={fOrigem} onChange={setFOrigem} placeholder="Origem" options={[{ value: "todos", label: "Todas origens" }, ...origensDisponiveis.map((o) => ({ value: o, label: o }))]} />
        <FilterSelect value={fFaixa} onChange={setFFaixa} placeholder="Faixa" options={[{ value: "todos", label: "Todas faixas" }, ...faixasDisponiveis.map((f) => ({ value: f, label: f }))]} />
      </div>

      {isMobile && (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
          <Button variant="ghost" size="sm" disabled={mobileStageIdx === 0} onClick={() => setMobileStageIdx((i) => Math.max(0, i - 1))}>←</Button>
          <div className="text-sm font-medium">{STAGES[mobileStageIdx].label}</div>
          <Button variant="ghost" size="sm" disabled={mobileStageIdx === STAGES.length - 1} onClick={() => setMobileStageIdx((i) => Math.min(STAGES.length - 1, i + 1))}>→</Button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={cn("flex-1 min-h-0", isMobile && "overflow-y-auto p-3")} style={isMobile ? undefined : { width: "100%", height: "100%", overflow: "auto" }}>
          <div style={isMobile ? undefined : { display: "flex", flexDirection: "row", gap: "12px", minWidth: "min-content", height: "100%", alignItems: "stretch", padding: "0 16px 16px" }}>
            {visibleStages.map((s) => (
              <Column
                key={s.key}
                stage={s}
                deals={byStage[s.key] ?? []}
                total={totals[s.key]}
                onCardClick={(d) => navigate(`/crm/${d.id}`)}
                isMobile={isMobile}
                pendingMap={pendingActivities}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeDeal && (
            <div className="rotate-2 opacity-70">
              <DealCard deal={activeDeal} onClick={() => {}} dragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} deal={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["deals"] })} />
      <WinDealDialog open={!!winDeal} onOpenChange={(o) => !o && setWinDeal(null)} deal={winDeal} onDone={() => qc.invalidateQueries({ queryKey: ["deals"] })} />
      <LoseDealDialog open={!!loseDeal} onOpenChange={(o) => !o && setLoseDeal(null)} deal={loseDeal} onDone={() => qc.invalidateQueries({ queryKey: ["deals"] })} />
      <CnpjSearchDialog open={cnpjDialogOpen} onOpenChange={setCnpjDialogOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["deals"] })} />
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Column({
  stage, deals, total, onCardClick, isMobile, pendingMap,
}: {
  stage: { key: DealStage; label: string; color: string };
  deals: Deal[];
  total: number;
  onCardClick: (d: Deal) => void;
  isMobile: boolean;
  pendingMap: Record<string, { count: number; overdue: boolean }>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.key });

  return (
    <div
      ref={setNodeRef}
      className={cn("rounded-lg border bg-muted/30 transition-colors", isMobile && "flex w-full flex-col mb-3", isOver && "border-primary ring-2 ring-primary/30")}
      style={isMobile ? undefined : { flex: "1 1 0", minWidth: "150px", height: "100%", display: "flex", flexDirection: "column", wordBreak: "break-word" }}
    >
      <div className="kanban-column-header rounded-t-lg bg-background/95 backdrop-blur">
        <div className="h-[3px] rounded-t-lg" style={{ backgroundColor: stage.color }} />
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-semibold">{stage.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{deals.length}</span>
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{fmtBRL(total)}</div>
        </div>
      </div>
      <div className={cn("flex flex-col gap-2 p-2", !isMobile && "scrollbar-thin")} style={isMobile ? undefined : { flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: "80px" }}>
        {deals.length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">Sem negócios</div>
        ) : (
          deals.map((d) => <DraggableCard key={d.id} deal={d} onClick={() => onCardClick(d)} pending={pendingMap[d.id]} />)
        )}
      </div>
    </div>
  );
}

function DraggableCard({ deal, onClick, pending }: { deal: Deal; onClick: () => void; pending?: { count: number; overdue: boolean } }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-none", isDragging && "opacity-30")}>
      <DealCard deal={deal} onClick={onClick} pending={pending} />
    </div>
  );
}

function DealCard({ deal, onClick, dragging, pending }: { deal: Deal; onClick: () => void; dragging?: boolean; pending?: { count: number; overdue: boolean } }) {
  const stageDays = daysBetween(deal.stage_changed_at || deal.updated_at);
  const etiq = ETIQUETA_OPTIONS.find((e) => e.value === deal.etiqueta);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
        dragging && "shadow-lg",
        pending?.overdue && "border-destructive/60 ring-1 ring-destructive/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{deal.company_name}</div>
          {deal.contact_name && <div className="mt-0.5 truncate text-xs text-muted-foreground">{deal.contact_name}</div>}
        </div>
        {pending && pending.count > 0 && (
          <div className={cn("relative shrink-0", pending.overdue ? "text-destructive" : "text-muted-foreground")} title={`${pending.count} atividade(s) pendente(s)`}>
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold">{pending.count}</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-500">{fmtBRL(Number(deal.value || 0))}</div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {deal.product && <Badge variant="secondary" className="text-[10px]">{PRODUCT_LABEL[deal.product]}</Badge>}
        {etiq && <Badge variant="outline" className="text-[10px]">{etiq.emoji} {etiq.label}</Badge>}
        {deal.faixa_colaboradores && <Badge variant="outline" className="text-[10px]">👥 {deal.faixa_colaboradores}</Badge>}
      </div>

      <div className="mt-2 text-[10px] text-muted-foreground">{stageDays}d na etapa</div>
    </button>
  );
}
