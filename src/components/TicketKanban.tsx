import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PriorityBadge } from "@/components/badges";
import { Sparkles, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { STATUS_FLOW, STATUS_LABEL, STATUS_TONE, type TicketStatus, TIMED_STAGES } from "@/lib/constants";
import { formatDuration } from "@/lib/formatters";
import { AutoCloseWarning } from "@/components/AutoCloseWarning";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

export interface CustomStage {
  id: string;
  stage_key: string;
  label: string;
  color: string;
  base_status: TicketStatus;
  ordem: number;
}

interface KanbanTicket {
  id: string;
  ticket_number: string;
  title: string;
  status: TicketStatus;
  priority: any;
  client?: { name: string } | null;
  current_stage_started_at: string;
  total_em_atendimento_seconds: number;
  total_aguardando_cliente_seconds: number;
  total_vera_n1_seconds: number;
  total_n2_seconds: number;
  entered_em_atendimento_at: string | null;
  entered_aguardando_cliente_at: string | null;
  entered_vera_n1_at: string | null;
  entered_n2_at: string | null;
  active_custom_stage_key: string | null;
}

interface Props {
  tickets: KanbanTicket[];
  showResolved?: boolean;
  assistedIds?: Set<string>;
  customStages?: CustomStage[];
  canManageStages?: boolean;
  onAddStageClick?: () => void;
}

// Map de cor da barra superior da coluna (estilo Pipedrive) por tom semântico
const STRIPE_BY_TONE: Record<string, string> = {
  info: "bg-info",
  warning: "bg-warning",
  muted: "bg-muted-foreground/40",
  success: "bg-success",
  neutral: "bg-muted-foreground/40",
  primary: "bg-primary",
  accent: "bg-accent",
  danger: "bg-danger",
};

function timeOnCurrentStage(t: KanbanTicket, now: number): number {
  const stage = TIMED_STAGES.find((s) => s.key === t.status);
  if (stage) {
    const enteredAt = (t as any)[stage.enteredCol] as string | null;
    if (enteredAt) return Math.max(0, (now - new Date(enteredAt).getTime()) / 1000);
  }
  return Math.max(0, (now - new Date(t.current_stage_started_at).getTime()) / 1000);
}

const PRIORITY_STRIPE: Record<string, string> = {
  urgente: "border-l-danger",
  critica: "border-l-danger",
  alta: "border-l-warning",
  media: "border-l-info",
  baixa: "border-l-muted-foreground/40",
};

const TicketCard = memo(function TicketCard({ t, now, isOverlay = false, hasAssist = false }: { t: KanbanTicket; now: number; isOverlay?: boolean; hasAssist?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  const navigate = useNavigate();
  const elapsed = timeOnCurrentStage(t, now);
  const stripeClass = PRIORITY_STRIPE[t.priority as string] ?? "border-l-muted-foreground/40";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/tickets/${t.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/tickets/${t.id}`);
        }
      }}
      style={{ contain: "layout paint", willChange: isDragging || isOverlay ? "transform" : undefined }}
      className={cn(
        "group cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "border-l-[3px]", stripeClass,
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "kanban-dragging shadow-lg",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground group-hover:text-primary">
          #{t.ticket_number}
        </span>
        <div className="flex items-center gap-1.5">
          {hasAssist && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Sparkles className="h-3 w-3 text-accent" />
              </TooltipTrigger>
              <TooltipContent side="top">Assist consultado</TooltipContent>
            </Tooltip>
          )}
          <PriorityBadge priority={t.priority} />
        </div>
      </div>
      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{t.title}</p>
      {t.client?.name && (
        <p className="mt-1.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="font-semibold text-foreground/80 normal-case tracking-normal">{t.client.name}</span>
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-mono">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
          {formatDuration(elapsed)}
        </span>
      </div>
      <AutoCloseWarning
        status={t.status}
        enteredAt={t.entered_aguardando_cliente_at}
        variant="card"
      />
    </div>
  );
});

interface ColumnProps {
  droppableId: string;
  label: string;
  stripeClass?: string;
  stripeColor?: string;
  tickets: KanbanTicket[];
  now: number;
  assistedIds?: Set<string>;
}

function Column({ droppableId, label, stripeClass, stripeColor, tickets, now, assistedIds }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount((prev) => Math.min(Math.max(prev, PAGE_SIZE), Math.max(tickets.length, PAGE_SIZE)));
  }, [tickets.length]);

  const visibleTickets = useMemo(() => tickets.slice(0, visibleCount), [tickets, visibleCount]);
  const hasMore = visibleCount < tickets.length;

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, tickets.length));
    }
  };

  return (
    <div
      className="rounded-lg bg-surface-muted/60"
      style={{ flex: "1 1 0", minWidth: "150px", height: "100%", display: "flex", flexDirection: "column", wordBreak: "break-word" }}
    >
      <div className="kanban-column-header rounded-t-lg bg-surface-muted/60">
        {stripeColor ? (
          <div className="h-[3px] w-full rounded-t-lg" style={{ backgroundColor: stripeColor }} />
        ) : (
          <div className={cn("h-[3px] w-full rounded-t-lg", stripeClass)} />
        )}
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5">
          <h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
            {label}
          </h3>
          <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {tickets.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: "80px", contain: "strict", overscrollBehavior: "contain" }}
        className={cn(
          "scrollbar-thin flex flex-col gap-2 px-2 pb-2 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40",
        )}
      >
        {tickets.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground/70">Nenhum chamado</p>
        ) : (
          <>
            {visibleTickets.map((t) => <TicketCard key={t.id} t={t} now={now} hasAssist={assistedIds?.has(t.id)} />)}
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, tickets.length))}
                className="mt-1 rounded-md border border-dashed border-border py-1.5 text-center text-[10px] text-muted-foreground hover:bg-background hover:text-foreground"
              >
                Carregar mais ({tickets.length - visibleCount})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
const MemoColumn = memo(Column);

function AddStageColumn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 bg-surface-muted/30 px-3 py-6 text-center transition-all hover:border-primary hover:bg-primary/5"
      style={{ flex: "1 1 0", minWidth: "150px", height: "100%" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <Plus className="h-7 w-7" />
      </div>
      <span className="text-[12px] font-semibold text-foreground/80">Nova etapa</span>
      <span className="text-[10px] text-muted-foreground">Adicionar uma coluna ao kanban</span>
    </button>
  );
}

export function TicketKanban({ tickets, showResolved = false, assistedIds, customStages = [], canManageStages = false, onAddStageClick }: Props) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const updateStage = useMutation({
    mutationFn: async ({ id, status, customKey }: { id: string; status: TicketStatus; customKey: string | null }) => {
      const { error } = await supabase
        .from("tickets")
        .update({ status, active_custom_stage_key: customKey } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      const stage = customStages.find((c) => c.stage_key === vars.customKey);
      toast.success(`Movido para ${stage?.label ?? STATUS_LABEL[vars.status]}.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Stage keys that exist for each base status
  const customByBase = useMemo(() => {
    const map: Record<string, CustomStage[]> = {};
    customStages.forEach((c) => {
      if (!map[c.base_status]) map[c.base_status] = [];
      map[c.base_status].push(c);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.ordem - b.ordem));
    return map;
  }, [customStages]);

  const validCustomKeysByBase = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    customStages.forEach((c) => {
      if (!map[c.base_status]) map[c.base_status] = new Set();
      map[c.base_status].add(c.stage_key);
    });
    return map;
  }, [customStages]);

  // group tickets by [base status, custom_key|null]
  const grouped = useMemo(() => {
    const baseMap: Record<TicketStatus, KanbanTicket[]> = {
      novo: [], em_atendimento: [], aguardando_cliente: [], suporte_vera_n1: [],
      abertura_chamado_n2: [], resolvido: [], fechado: [],
    };
    const customMap: Record<string, KanbanTicket[]> = {};
    tickets.forEach((t) => {
      const base = (t.status === "fechado" ? "resolvido" : t.status) as TicketStatus;
      const key = t.active_custom_stage_key;
      if (key && validCustomKeysByBase[base]?.has(key)) {
        if (!customMap[key]) customMap[key] = [];
        customMap[key].push(t);
      } else {
        baseMap[base].push(t);
      }
    });
    return { baseMap, customMap };
  }, [tickets, validCustomKeysByBase]);

  const activeTicket = useMemo(
    () => (activeId ? tickets.find((t) => t.id === activeId) : null),
    [activeId, tickets],
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      if (!e.over) return;
      const id = String(e.active.id);
      const overId = String(e.over.id);
      const ticket = tickets.find((t) => t.id === id);
      if (!ticket) return;

      const currentBase = (ticket.status === "fechado" ? "resolvido" : ticket.status) as TicketStatus;
      const currentCustom = ticket.active_custom_stage_key ?? null;

      let targetStatus: TicketStatus;
      let targetCustom: string | null;

      if (overId.startsWith("custom:")) {
        const slug = overId.slice("custom:".length);
        const stage = customStages.find((c) => c.stage_key === slug);
        if (!stage) return;
        targetStatus = stage.base_status;
        targetCustom = slug;
      } else {
        targetStatus = overId as TicketStatus;
        targetCustom = null;
      }

      if (currentBase === targetStatus && currentCustom === targetCustom) return;
      updateStage.mutate({ id, status: targetStatus, customKey: targetCustom });
    },
    [tickets, updateStage, customStages],
  );

  const visibleBaseStatuses = STATUS_FLOW.filter((s) => showResolved || s !== "resolvido");

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
        <div
          style={{
            display: "flex", flexDirection: "row", gap: "12px",
            minWidth: "min-content", height: "100%", alignItems: "stretch", padding: "0 16px 16px",
          }}
        >
          {visibleBaseStatuses.flatMap((status) => [
            <MemoColumn
              key={status}
              droppableId={status}
              label={STATUS_LABEL[status]}
              stripeClass={STRIPE_BY_TONE[STATUS_TONE[status]] ?? "bg-muted-foreground/40"}
              tickets={grouped.baseMap[status]}
              now={now}
              assistedIds={assistedIds}
            />,
            ...(customByBase[status] ?? []).map((cs) => (
              <MemoColumn
                key={`custom-${cs.id}`}
                droppableId={`custom:${cs.stage_key}`}
                label={cs.label}
                stripeColor={cs.color}
                tickets={grouped.customMap[cs.stage_key] ?? []}
                now={now}
                assistedIds={assistedIds}
              />
            )),
          ])}
          {canManageStages && onAddStageClick && (
            <AddStageColumn onClick={onAddStageClick} />
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {activeTicket ? <TicketCard t={activeTicket} now={now} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
