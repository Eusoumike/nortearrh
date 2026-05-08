import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getClientPrimary,
  getClientSecondary,
  getClientLabel,
  filterAndSortClients,
} from "@/lib/clientDisplay";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any | null;
  invalidateKeys?: (string | (string | undefined)[])[];
  canDelete?: boolean;
}

export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  invalidateKeys = [],
  canDelete = true,
}: EditTaskDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    status: "pendente",
    priority: "media",
    assigned_to: "__none__",
    due_date: "",
    client_id: "__none__",
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title ?? "",
        description: task.description ?? "",
        category: task.category ?? "",
        status: task.status ?? "pendente",
        priority: task.priority ?? "media",
        assigned_to: task.assigned_to ?? "__none__",
        due_date: task.due_date ?? "",
        client_id: task.client_id ?? "__none__",
      });
    }
  }, [task]);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, contact_name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_categories")
        .select("id, name, emoji")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const invalidate = () => {
    invalidateKeys.forEach((key) =>
      qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }),
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error("Tarefa inválida");
      if (!form.title.trim()) throw new Error("Título obrigatório");
      const assigned_to =
        form.assigned_to === "__none__" ? null : form.assigned_to;
      const assigned_name =
        assigned_to
          ? profiles?.find((p: any) => p.id === assigned_to)?.full_name ?? null
          : null;
      const client_id = form.client_id === "__none__" ? null : form.client_id;
      const { error } = await supabase
        .from("tasks")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category.trim() || null,
          status: form.status,
          priority: form.priority,
          assigned_to,
          assigned_name,
          due_date: form.due_date || null,
          client_id,
        } as any)
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa atualizada.");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar. Tente novamente."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error("Tarefa inválida");
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa excluída.");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar. Tente novamente."),
  });

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Classificação</Label>
              <Select
                value={form.category || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, category: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem classificação</SelectItem>
                  {/* Tarefa antiga com texto livre que não está na lista — mantém compatibilidade */}
                  {form.category &&
                    !categories?.some((c: any) => c.name === form.category) && (
                      <SelectItem value={form.category}>
                        {form.category} (legado)
                      </SelectItem>
                    )}
                  {categories?.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.emoji ? `${c.emoji} ` : ""}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={form.assigned_to}
                onValueChange={(v) => setForm({ ...form, assigned_to: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {profiles?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente vinculado</Label>
              <TaskClientPicker
                clients={(clients ?? []) as any[]}
                value={form.client_id}
                onSelect={(id) => setForm({ ...form, client_id: id })}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div>
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é permanente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => remove.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={save.isPending || !form.title.trim()}
                className="bg-gradient-brand text-primary-foreground hover:opacity-90"
              >
                {save.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
