import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Play, Square, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TIMED_STAGES, SLA_PER_STAGE_HOURS } from "@/lib/constants";
import { formatDuration } from "@/lib/formatters";

type CustomStage = {
  id: string;
  stage_key: string;
  label: string;
  sla_hours: number;
  ordem: number;
  ativo: boolean;
};

type StageTime = { stage_key: string; total_seconds: number };

interface Props {
  ticket: any;
}

export function TicketStageTimer({ ticket }: Props) {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canManage = role === "admin" || role === "manager";
  const [now, setNow] = useState(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const { data: customStages = [] } = useQuery({
    queryKey: ["custom-ticket-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_ticket_stages" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomStage[];
    },
  });

  const { data: stageTimes = [] } = useQuery({
    queryKey: ["ticket-stage-times", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_stage_times" as any)
        .select("stage_key, total_seconds")
        .eq("ticket_id", ticket.id);
      if (error) throw error;
      return (data ?? []) as StageTime[];
    },
  });

  const setActiveStage = useMutation({
    mutationFn: async (stage_key: string | null) => {
      const { error } = await supabase
        .from("tickets")
        .update({ active_custom_stage_key: stage_key } as any)
        .eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: (_d, key) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["ticket-stage-times", ticket.id] });
      toast.success(key ? "Cronômetro iniciado" : "Cronômetro parado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ----- Etapas fixas -----
  const fixedRows = TIMED_STAGES.map((stage) => {
    const total = (ticket as any)[stage.totalCol] ?? 0;
    const enteredAt = (ticket as any)[stage.enteredCol] as string | null;
    const live = enteredAt ? Math.max(0, (now - new Date(enteredAt).getTime()) / 1000) : 0;
    const seconds = total + live;
    const slaSec = SLA_PER_STAGE_HOURS[stage.key] * 3600;
    return {
      key: stage.key as string,
      label: stage.label,
      seconds,
      slaSec,
      isActive: ticket.status === stage.key,
      isCustom: false,
    };
  });

  // ----- Etapas customizadas -----
  const activeCustomKey = ticket.active_custom_stage_key as string | null;
  const customStarted = ticket.custom_stage_started_at as string | null;
  const customRows = customStages.map((cs) => {
    const persisted = stageTimes.find((t) => t.stage_key === cs.stage_key)?.total_seconds ?? 0;
    const live =
      activeCustomKey === cs.stage_key && customStarted
        ? Math.max(0, (now - new Date(customStarted).getTime()) / 1000)
        : 0;
    const seconds = persisted + live;
    return {
      key: cs.stage_key,
      label: cs.label,
      seconds,
      slaSec: cs.sla_hours * 3600,
      isActive: activeCustomKey === cs.stage_key,
      isCustom: true,
    };
  });

  const allRows = [...fixedRows, ...customRows];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tempo por etapa
        </p>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[11px]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3 w-3" /> Etapa
          </Button>
        )}
      </div>

      <div className="space-y-2.5">
        {allRows.map((s) => {
          const overSla = s.slaSec > 0 && s.seconds > s.slaSec;
          const pct = s.slaSec > 0 ? Math.min(100, (s.seconds / s.slaSec) * 100) : 0;
          const barColor = overSla
            ? "bg-danger"
            : s.isActive
            ? "bg-primary"
            : s.seconds > 0
            ? "bg-success"
            : "bg-muted";
          return (
            <div key={s.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={`flex min-w-0 flex-1 items-center gap-1.5 truncate ${
                    s.isActive ? "font-medium text-primary" : ""
                  }`}
                >
                  {s.isActive && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  )}
                  <span className="truncate">{s.label}</span>
                </span>
                <span
                  className={`font-mono text-[11px] ${
                    overSla
                      ? "text-danger font-semibold"
                      : s.isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.seconds > 0 ? formatDuration(s.seconds) : "—"}
                </span>
                {s.isCustom && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 shrink-0"
                    title={s.isActive ? "Parar cronômetro" : "Iniciar cronômetro"}
                    onClick={() => setActiveStage.mutate(s.isActive ? null : s.key)}
                    disabled={setActiveStage.isPending}
                  >
                    {s.isActive ? (
                      <Square className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {canManage && (
        <CreateStageDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          existingStages={customStages}
        />
      )}
    </div>
  );
}

function CreateStageDialog({
  open,
  onOpenChange,
  existingStages,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingStages: CustomStage[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [label, setLabel] = useState("");
  const [slaHours, setSlaHours] = useState("8");

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Informe o nome da etapa");
      let key = slugify(trimmed);
      if (!key) throw new Error("Nome inválido");
      // ensure unique
      const taken = new Set(existingStages.map((s) => s.stage_key));
      let suffix = 1;
      let unique = key;
      while (taken.has(unique)) {
        unique = `${key}_${suffix++}`;
      }
      const sla = Math.max(0, Number(slaHours) || 0);
      const ordem = (existingStages[existingStages.length - 1]?.ordem ?? 0) + 1;
      const { error } = await supabase.from("custom_ticket_stages" as any).insert({
        stage_key: unique,
        label: trimmed,
        sla_hours: sla,
        ordem,
        ativo: true,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
      toast.success("Etapa criada");
      setLabel("");
      setSlaHours("8");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_ticket_stages" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
      toast.success("Etapa removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova etapa cronometrada</DialogTitle>
          <DialogDescription>
            A etapa fica disponível em todos os chamados. Use os botões play/stop para cronometrar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="stage-label">Nome</Label>
            <Input
              id="stage-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Aguardando fornecedor"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stage-sla">SLA (horas)</Label>
            <Input
              id="stage-sla"
              type="number"
              min="0"
              step="0.5"
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
            />
          </div>

          {existingStages.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Etapas existentes</p>
              <div className="space-y-1">
                {existingStages.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border bg-surface-muted/30 px-2 py-1.5 text-xs"
                  >
                    <span className="truncate">
                      {s.label}{" "}
                      <span className="text-muted-foreground">· SLA {s.sla_hours}h</span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => remove.mutate(s.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Criar etapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
