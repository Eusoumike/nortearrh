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
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { HealthBadge } from "@/components/badges";
import { Plus, Search, Building2, Mail, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HEALTH_LABEL, type ClientHealth } from "@/lib/constants";

export default function Clients() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
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

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} clientes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90">
              <Plus className="mr-1.5 h-4 w-4" /> Novo cliente
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
                  <Label>Saúde</Label>
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
                  <Label>Motivo da atenção</Label>
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
            <Link key={c.id} to={`/clientes/${c.id}`}>
              <Card className="group relative h-full p-4 transition-all hover:border-primary/40 hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.company && <p className="truncate text-xs text-muted-foreground">{c.company}</p>}
                  </div>
                  <HealthBadge health={c.health} />
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {c.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /> {c.email}</p>}
                  {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>}
                </div>
                {c.health_reason && (
                  <p className="mt-2 line-clamp-2 border-t border-border pt-2 text-xs italic text-muted-foreground">"{c.health_reason}"</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
