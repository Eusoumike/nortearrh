import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge, StatusBadge, PriorityBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Phone, Building2, Loader2, Pencil, Star, Send, Copy, Monitor } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { HEALTH_LABEL, type ClientHealth } from "@/lib/constants";
import { timeAgo, formatBrazilDate } from "@/lib/formatters";
import { EditClientDialog } from "@/components/EditClientDialog";

export default function ClientDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tickets } = useQuery({
    queryKey: ["client-tickets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_number, title, status, priority, created_at")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // NPS: busca a resposta mais recente do cliente (por client_id ou empresa)
  const { data: npsLatest } = useQuery({
    queryKey: ["client-nps", id, client?.company, client?.name],
    queryFn: async () => {
      if (!id) return null;
      // 1. Por client_id direto
      const byId = await supabase
        .from("nps_responses")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (byId.data && byId.data.length > 0) return byId.data[0];
      // 2. Fallback por nome de empresa (case-insensitive)
      const empresa = (client?.company || client?.name || "").trim();
      if (!empresa) return null;
      const byEmpresa = await supabase
        .from("nps_responses")
        .select("*")
        .ilike("empresa", empresa)
        .order("created_at", { ascending: false })
        .limit(1);
      return byEmpresa.data?.[0] ?? null;
    },
    enabled: !!id && !!client,
  });

  const sendSurvey = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Cliente não carregado");
      let token = client.nps_token;
      if (!token) {
        token = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
        const { error } = await supabase
          .from("clients")
          .update({ nps_token: token })
          .eq("id", id!);
        if (error) throw error;
      }
      const url = `${window.location.origin}/pesquisa/${token}`;
      await navigator.clipboard.writeText(url);
      return url;
    },
    onSuccess: (url) => {
      qc.invalidateQueries({ queryKey: ["client", id] });
      toast.success("Link copiado: " + url);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (client) setForm(client); }, [client]);

  const save = useMutation({
    mutationFn: async () => {
      const idTrim = (form.anydesk_id ?? "").trim();
      const senhaTrim = (form.anydesk_senha ?? "").trim();
      let anydeskIdValue: string | null = null;
      let anydeskSenhaValue: string | null = null;
      // Se algum dos dois for preenchido, validar ambos
      if (idTrim || senhaTrim) {
        const idDigits = idTrim.replace(/[\s-]/g, "");
        if (!idTrim) throw new Error("Informe o ID do AnyDesk.");
        if (!/^\d+$/.test(idDigits)) throw new Error("ID do AnyDesk inválido: use apenas números.");
        if (idDigits.length < 6 || idDigits.length > 12) throw new Error("ID do AnyDesk inválido: deve ter entre 6 e 12 dígitos.");
        if (!senhaTrim) throw new Error("Informe a senha do AnyDesk.");
        if (senhaTrim.length < 4) throw new Error("Senha do AnyDesk muito curta (mínimo 4 caracteres).");
        anydeskIdValue = idDigits;
        anydeskSenhaValue = senhaTrim;
      }
      const { error } = await supabase.from("clients").update({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        health: form.health,
        health_reason: form.health_reason || null,
        notes: form.notes || null,
        anydesk_id: anydeskIdValue,
        anydesk_senha: anydeskSenhaValue,
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente atualizado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !client || !form) {
    return <div className="space-y-3 p-6"><Skeleton className="h-6 w-32" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-4 p-6">
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para clientes
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <HealthBadge health={client.health} />
          </div>
          {client.company && <p className="text-sm text-muted-foreground">{client.company}</p>}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" /> Editar cliente
        </Button>
      </div>

      <EditClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Informações</h2>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                <Label>Motivo</Label>
                <Input value={form.health_reason ?? ""} onChange={(e) => setForm({ ...form, health_reason: e.target.value })} disabled={form.health === "saudavel"} />
              </div>
              <div className="space-y-1.5">
                <Label>ID AnyDesk</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.anydesk_id ?? ""}
                    onChange={(e) => setForm({ ...form, anydesk_id: e.target.value })}
                    placeholder="Somente números"
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!form.anydesk_id?.trim()}
                    onClick={() => {
                      navigator.clipboard.writeText(form.anydesk_id ?? "");
                      toast.success("ID copiado");
                    }}
                    title="Copiar ID"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Senha AnyDesk</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.anydesk_senha ?? ""}
                    onChange={(e) => setForm({ ...form, anydesk_senha: e.target.value })}
                    placeholder="Senha de acesso"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!form.anydesk_senha?.trim()}
                    onClick={() => {
                      navigator.clipboard.writeText(form.anydesk_senha ?? "");
                      toast.success("Senha copiada");
                    }}
                    title="Copiar senha"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={4} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</h3>
            <div className="space-y-2 text-sm">
              {client.company && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {client.company}</p>}
              {client.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {client.email}</p>}
              {client.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {client.phone}</p>}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">NPS</h3>
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {npsLatest ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">{npsLatest.nps_score ?? "—"}</span>
                  {npsLatest.nps_score !== null && npsLatest.nps_score !== undefined && (
                    <Badge
                      className={
                        npsLatest.nps_score >= 9
                          ? "bg-success/15 text-success hover:bg-success/15"
                          : npsLatest.nps_score >= 7
                            ? "bg-warning/15 text-warning hover:bg-warning/15"
                            : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                      }
                    >
                      {npsLatest.nps_score >= 9 ? "Promotor" : npsLatest.nps_score >= 7 ? "Neutro" : "Detrator"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {npsLatest.nome} · {formatBrazilDate(npsLatest.created_at)}
                </p>
                {npsLatest.feedback_aberto && (
                  <p className="line-clamp-3 rounded-md bg-surface-muted/50 p-2 text-xs italic">
                    "{npsLatest.feedback_aberto}"
                  </p>
                )}
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-muted-foreground">Sem respostas ainda.</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => sendSurvey.mutate()}
              disabled={sendSurvey.isPending}
            >
              {sendSurvey.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Enviar pesquisa NPS
            </Button>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tickets</h3>
              <span className="font-mono text-xs text-muted-foreground">{tickets?.length ?? 0}</span>
            </div>
            {!tickets || tickets.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nenhum ticket.</p>
            ) : (
              <div className="-mx-2 max-h-80 space-y-1 overflow-y-auto">
                {tickets.map((t) => (
                  <Link key={t.id} to={`/tickets/${t.id}`} className="block rounded-md px-2 py-2 transition-colors hover:bg-surface-muted">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">#{t.ticket_number}</span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="truncate text-sm">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(t.created_at)}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
