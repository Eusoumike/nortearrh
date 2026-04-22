import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToneBadge } from "@/components/ui/tone-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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
import { HealthBadge } from "@/components/badges";
import { EditClientDialog } from "@/components/EditClientDialog";
import { Plus, Search, Building2, Mail, Phone, Loader2, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HEALTH_LABEL, type ClientHealth } from "@/lib/constants";

export default function Clients() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editClient, setEditClient] = useState<any | null>(null);
  const [deleteClient, setDeleteClient] = useState<any | null>(null);
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = (clients ?? []).filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.company?.toLowerCase().includes(q.toLowerCase()) || c.email?.toLowerCase().includes(q.toLowerCase())
  );

  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", health: "saudavel" as ClientHealth, health_reason: "", notes: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("clients").insert({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        health: form.health,
        health_reason: form.health_reason || null,
        notes: form.notes || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-clients"] });
      qc.invalidateQueries({ queryKey: ["clients-min"] });
      toast.success("Cliente criado.");
      setOpen(false);
      setForm({ name: "", company: "", email: "", phone: "", health: "saudavel", health_reason: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-clients"] });
      qc.invalidateQueries({ queryKey: ["clients-min"] });
      toast.success("Cliente excluído.");
      setDeleteClient(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncPipedrive = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("pipedrive-sync");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { inserted: number; unique_clients: number; skipped_existing: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-min"] });
      toast.success(
        `Sincronização concluída: ${data.inserted} novos · ${data.skipped_existing} já existiam`,
      );
    },
    onError: (e: any) => toast.error(`Pipedrive: ${e.message}`),
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Clientes</h1>
          <p className="text-xs text-muted-foreground md:text-sm">{filtered.length} clientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => syncPipedrive.mutate()}
            disabled={syncPipedrive.isPending}
            title="Importa deals ganhos do Pipedrive como clientes (dedup por organização)"
          >
            {syncPipedrive.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            <span className="hidden sm:inline">Sincronizar Pipedrive</span>
            <span className="sm:hidden">Sync</span>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90">
                <Plus className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Novo cliente</span><span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.health} onValueChange={(v) => setForm({ ...form, health: v as ClientHealth })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(HEALTH_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              {form.health !== "saudavel" && (
                <div className="space-y-1.5">
                  <Label>Motivo</Label>
                  <Input value={form.health_reason} onChange={(e) => setForm({ ...form, health_reason: e.target.value })} placeholder="Ex.: contrato em renovação" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending || !form.name} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, empresa ou e-mail…" className="h-9 pl-8" />
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground">Comece cadastrando seu primeiro cliente.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="group relative h-full p-4 transition-all hover:border-primary/40 hover:shadow-md">
              <Link to={`/clientes/${c.id}`} className="absolute inset-0 z-0" aria-label={`Abrir ${c.name}`} />
              <div className="relative z-10 pointer-events-none">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{c.name}</p>
                      {(() => {
                        if (!c.pipedrive_person_id || !c.created_at) return null;
                        const ageMs = Date.now() - new Date(c.created_at).getTime();
                        if (ageMs < 0 || ageMs >= 48 * 60 * 60 * 1000) return null;
                        return (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                            Novo
                          </span>
                        );
                      })()}
                    </div>
                    {c.company && <p className="truncate text-xs text-muted-foreground">{c.company}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <HealthBadge health={c.health} />
                    {c.pipedrive_person_id && (
                      <ToneBadge tone="warning" size="sm">
                        Pipedrive
                      </ToneBadge>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /> {c.email}</p>}
                  {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>}
                </div>
                {c.health_reason && (
                  <p className="mt-2 line-clamp-2 border-t border-border pt-2 text-xs italic text-muted-foreground">"{c.health_reason}"</p>
                )}
              </div>
              <div className="absolute right-2 top-2 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 bg-background/80 backdrop-blur hover:bg-background"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditClient(c);
                  }}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 bg-background/80 text-destructive backdrop-blur hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteClient(c);
                  }}
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editClient && (
        <EditClientDialog
          client={editClient}
          open={!!editClient}
          onOpenChange={(o) => !o && setEditClient(null)}
        />
      )}

      <AlertDialog open={!!deleteClient} onOpenChange={(o) => !o && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente <strong>{deleteClient?.name}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteClient) remove.mutate(deleteClient.id);
              }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
