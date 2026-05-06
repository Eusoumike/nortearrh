import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { GripVertical, Pencil, Trash2, Plus, Loader2 } from "lucide-react";

type Stage = {
  id: string;
  stage_key: string;
  label: string;
  color: string;
  ordem: number;
  ativo: boolean;
  is_system: boolean;
};

const slugify = (s: string) =>
  "custom_" +
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) +
  "_" +
  Math.random().toString(36).slice(2, 6);

function StageRow({
  stage,
  onEdit,
  onDelete,
}: {
  stage: Stage;
  onEdit: (s: Stage) => void;
  onDelete: (s: Stage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: stage.is_system,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={`cursor-grab text-muted-foreground hover:text-foreground ${stage.is_system ? "opacity-30 cursor-not-allowed" : ""}`}
        aria-label="Arrastar"
        disabled={stage.is_system}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-3 w-3 shrink-0 rounded-full border"
        style={{ backgroundColor: stage.color }}
        aria-hidden
      />
      <span className="flex-1 truncate text-sm font-medium">{stage.label}</span>
      {stage.is_system && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          Padrão
        </Badge>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(stage)} aria-label="Editar">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      {stage.is_system ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-30" disabled aria-label="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Etapas padrão não podem ser excluídas</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(stage)}
          aria-label="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function EtapasChamadosSection() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Stage | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Stage | null>(null);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["custom-ticket-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_ticket_stages")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Stage[];
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reorderMut = useMutation({
    mutationFn: async (newList: Stage[]) => {
      const updates = newList.map((s, i) =>
        supabase.from("custom_ticket_stages").update({ ordem: i }).eq("id", s.id),
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
      qc.invalidateQueries({ queryKey: ["kanban-stages"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reordenar"),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = stages.findIndex((s) => s.id === e.active.id);
    const newIdx = stages.findIndex((s) => s.id === e.over!.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const target = stages[newIdx];
    if (target.stage_key === "novo" && newIdx === 0) return;
    if (target.stage_key === "resolvido") return;
    const next = arrayMove(stages, oldIdx, newIdx);
    next.sort((a, b) => {
      if (a.stage_key === "novo") return -1;
      if (b.stage_key === "novo") return 1;
      if (a.stage_key === "resolvido") return 1;
      if (b.stage_key === "resolvido") return -1;
      return 0;
    });
    qc.setQueryData(["custom-ticket-stages"], next);
    reorderMut.mutate(next);
  };

  const totalAtivas = stages.length;

  return (
    <Card>
      <Accordion type="single" collapsible>
        <AccordionItem value="etapas" className="border-0">
          <CardHeader className="pb-2">
            <AccordionTrigger className="py-0 hover:no-underline">
              <div className="flex flex-col items-start text-left">
                <CardTitle className="text-base">Etapas dos Chamados</CardTitle>
                <CardDescription className="text-xs">
                  {isLoading ? "Carregando…" : `${totalAtivas} etapa${totalAtivas === 1 ? "" : "s"} ativa${totalAtivas === 1 ? "" : "s"}`}
                </CardDescription>
              </div>
            </AccordionTrigger>
          </CardHeader>
          <AccordionContent>
            <CardContent className="space-y-1.5 pt-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {stages.map((s) => (
                    <StageRow key={s.id} stage={s} onEdit={setEditing} onDelete={setDeleting} />
                  ))}
                </SortableContext>
              </DndContext>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-8 w-full border-dashed text-xs"
                onClick={() => setCreating(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Nova etapa
              </Button>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {creating && (
        <StageDialog
          stages={stages}
          onClose={() => setCreating(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
            qc.invalidateQueries({ queryKey: ["kanban-stages"] });
            setCreating(false);
          }}
        />
      )}

      {editing && (
        <StageDialog
          stages={stages}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
            qc.invalidateQueries({ queryKey: ["kanban-stages"] });
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteStageDialog
          stage={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            qc.invalidateQueries({ queryKey: ["custom-ticket-stages"] });
            qc.invalidateQueries({ queryKey: ["kanban-stages"] });
            qc.invalidateQueries({ queryKey: ["tickets"] });
            setDeleting(null);
          }}
        />
      )}
    </Card>
  );
}

function StageDialog({
  stages,
  editing,
  onClose,
  onSaved,
}: {
  stages: Stage[];
  editing?: Stage;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [label, setLabel] = useState(editing?.label ?? "");
  const [color, setColor] = useState(editing?.color ?? "#6366f1");
  const [insertAfterId, setInsertAfterId] = useState<string>(() => {
    if (isEdit) return "";
    const beforeResolvido = stages.filter((s) => s.stage_key !== "resolvido");
    return beforeResolvido[beforeResolvido.length - 1]?.id ?? "";
  });
  const [saving, setSaving] = useState(false);

  const insertOptions = useMemo(
    () => stages.filter((s) => s.stage_key !== "resolvido"),
    [stages],
  );

  const save = async () => {
    if (!label.trim()) {
      toast.error("Nome da etapa é obrigatório");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase
          .from("custom_ticket_stages")
          .update({ label: label.trim(), color })
          .eq("id", editing!.id);
        if (error) throw error;
        toast.success("Etapa atualizada");
      } else {
        const afterStage = stages.find((s) => s.id === insertAfterId);
        const targetOrdem = afterStage ? afterStage.ordem + 1 : 1;
        const toShift = stages.filter((s) => s.ordem >= targetOrdem);
        for (const s of toShift) {
          await supabase
            .from("custom_ticket_stages")
            .update({ ordem: s.ordem + 1 })
            .eq("id", s.id);
        }
        const { error } = await supabase.from("custom_ticket_stages").insert({
          stage_key: slugify(label),
          label: label.trim(),
          color,
          ordem: targetOrdem,
          ativo: true,
          is_system: false,
          sla_hours: 8,
        });
        if (error) throw error;
        toast.success("Etapa criada com sucesso");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar etapa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar etapa" : "Nova etapa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Em validação" />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 font-mono text-xs" />
            </div>
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Inserir após</Label>
              <Select value={insertAfterId} onValueChange={setInsertAfterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Posição" />
                </SelectTrigger>
                <SelectContent>
                  {insertOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Após “{s.label}”
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStageDialog({
  stage,
  onClose,
  onDeleted,
}: {
  stage: Stage;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase
        .from("tickets")
        .update({ kanban_stage_key: "em_atendimento" })
        .eq("kanban_stage_key", stage.stage_key);
      const { error } = await supabase.from("custom_ticket_stages").delete().eq("id", stage.id);
      if (error) throw error;
      toast.success("Etapa excluída com sucesso");
      onDeleted();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir a etapa “{stage.label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Se houver chamados nesta etapa, eles serão movidos para “Em Atendimento”. Esta ação não pode
            ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
