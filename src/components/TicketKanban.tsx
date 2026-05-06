import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PriorityBadge } from "@/components/badges";
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
import { type TicketStatus, TIMED_STAGES } from "@/lib/constants";
import { formatDuration } from "@/lib/formatters";
import { AutoCloseWarning } from "@/components/AutoCloseWarning";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

const SYSTEM_STAGE_KEYS = new Set<string>([
  "novo",
  "em_atendimento",
  "aguardando_cliente",
  "suporte_vera_n1",
  "abertura_chamado_n2",
  "resolvido",
]);

interface KanbanTicket {
  id: string;
  ticket_number: string;
  title: string;
  status: TicketStatus;
  kanban_stage_key?: string | null;
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
}

interface StageDef {
  id: string;
  stage_key: string;
  label: string;
  color: string;
  ordem: number;
  is_system: boolean;
}

interface Props {
  tickets: KanbanTicket[];
}

function timeOnCurrentStage(t: KanbanTicket, now: number): number {
  const stage = TIMED_STAGES.find((s) => s.key === t.status);
  if (stage) {
    const enteredAt = (t as any)[stage.enteredCol] as string | null;
    if (enteredAt) return Math.max(0, (now - new Date(enteredAt).getTime()) / 1000);
  }
  return Math.max(0, (now - new Date(t.current_stage_started_at).getTime()) / 1000);
}

const TicketCard = memo(function TicketCard({ t, now, isOverlay = false }: { t: KanbanTicket; now: number; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  const navigate = useNavigate();
  const elapsed = timeOnCurrentStage(t, now);

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
        "group cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-sm transition-colors duration-150 hover:border-primary/40 hover:shadow-md active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "kanban-dragging shadow-lg",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary">
          #{t.ticket_number}
        </span>
        <PriorityBadge priority={t.priority} />
      </div>
      <p className="line-clamp-2 text-xs font-semibold leading-snug">{t.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="truncate">{t.client?.name ?? "Sem cliente"}</span>
        <span className="font-mono shrink-0">{formatDuration(elapsed)}</span>
      </div>
      <AutoCloseWarning
        status={t.status}
        enteredAt={t.entered_aguardando_cliente_at}
        variant="card"
      />
    </div>
  );
});

function Column({ stage, tickets, now }: { stage: StageDef; tickets: KanbanTicket[]; now: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.stage_key });
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
      style={{
        flex: "1 1 0",
        minWidth: "150px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        wordBreak: "break-word",
      }}
    >
      <div className="kanban-column-header rounded-t-lg bg-surface-muted/60">
        <div className="h-[3px] w-full rounded-t-lg" style={{ backgroundColor: stage.color }} />
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5">
          <h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
            {stage.label}
          </h3>
          <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {tickets.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          minHeight: "80px",
          contain: "strict",
          overscrollBehavior: "contain",
        }}
        className={cn(
          "scrollbar-thin flex flex-col gap-2 px-2 pb-2 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40",
        )}
      >
        {tickets.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground/70">Nenhum chamado</p>
        ) : (
          <>
            {visibleTickets.map((t) => <TicketCard key={t.id} t={t} now={now} />)}
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

export function TicketKanban({ tickets }: Props) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  // Stages from DB (realtime-ish via invalidation)
  const { data: stages = [] } = useQuery({
    queryKey: ["kanban-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_ticket_stages")
        .select("id, stage_key, label, color, ordem, is_system, ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StageDef[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("custom_ticket_stages_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_ticket_stages" }, () => {
        qc.invalidateQueries({ queryKey: ["kanban-stages"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const updateStage = useMutation({
    mutationFn: async ({ id, stageKey }: { id: string; stageKey: string }) => {
      const isSystem = SYSTEM_STAGE_KEYS.has(stageKey);
      const update: Record<string, any> = { kanban_stage_key: stageKey };
      if (isSystem) update.status = stageKey;
      const { error } = await supabase.from("tickets").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      const stage = stages.find((s) => s.stage_key === vars.stageKey);
      toast.success(`Movido para ${stage?.label ?? vars.stageKey}.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, KanbanTicket[]>();
    stages.forEach((s) => map.set(s.stage_key, []));
    tickets.forEach((t) => {
      let key = t.kanban_stage_key ?? (t.status === "fechado" ? "resolvido" : t.status);
      if (!map.has(key)) {
        // Stage was deleted — fallback
        key = "em_atendimento";
        if (!map.has(key)) key = stages[0]?.stage_key ?? key;
      }
      map.get(key)?.push(t);
    });
    return map;
  }, [tickets, stages]);

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
      const newStageKey = String(e.over.id);
      const ticket = tickets.find((t) => t.id === id);
      if (!ticket) return;
      const currentKey = ticket.kanban_stage_key ?? (ticket.status === "fechado" ? "resolvido" : ticket.status);
      if (currentKey === newStageKey) return;
      updateStage.mutate({ id, stageKey: newStageKey });
    },
    [tickets, updateStage],
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            minWidth: "min-content",
            height: "100%",
            alignItems: "stretch",
            padding: "0 16px 16px",
          }}
        >
          {stages.map((stage) => (
            <MemoColumn key={stage.id} stage={stage} tickets={grouped.get(stage.stage_key) ?? []} now={now} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {activeTicket ? <TicketCard t={activeTicket} now={now} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
