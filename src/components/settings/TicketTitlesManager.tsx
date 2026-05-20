import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TicketTitle {
  id: string;
  name: string;
}

export function TicketTitlesManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<TicketTitle | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [removeTarget, setRemoveTarget] = useState<TicketTitle | null>(null);

  const { data: titles, isLoading } = useQuery({
    queryKey: ["ticket-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_titles" as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as TicketTitle[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      if (!n) throw new Error("Nome obrigatório");
      if (editing) {
        const { error } = await supabase
          .from("ticket_titles" as any)
          .update({ name: n } as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ticket_titles" as any)
          .insert({ name: n, created_by: user?.id ?? null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-titles"] });
      toast.success(editing ? "Título atualizado." : "Título criado.");
      setEditing(null);
      setCreating(false);
      setName("");
    },
    onError: (e: any) => {
      const msg = String(e.message ?? "");
      if (msg.includes("unique") || msg.includes("duplicate")) {
        toast.error("Já existe um título com esse nome.");
      } else {
        toast.error(msg || "Erro ao salvar.");
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticket_titles" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-titles"] });
      toast.success("Título removido.");
      setRemoveTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover."),
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCreating(true);
  };
  const openEdit = (t: TicketTitle) => {
    setCreating(false);
    setEditing(t);
    setName(t.name);
  };
  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
    setName("");
  };

  const dialogOpen = creating || !!editing;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Títulos de chamado</CardTitle>
          <CardDescription>
            Opções pré-cadastradas que aparecem no campo "Título" do formulário de chamado.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo título
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && (titles ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum título cadastrado.</p>
        )}
        {(titles ?? []).map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <span className="text-sm">{t.name}</span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openEdit(t)}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setRemoveTarget(t)}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar título" : "Novo título"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Dúvida sobre o sistema"
              autoFocus
              maxLength={150}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !name.trim()}>
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir título?</AlertDialogTitle>
            <AlertDialogDescription>
              "{removeTarget?.name}" será removido da lista. Chamados existentes não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTarget && remove.mutate(removeTarget.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
