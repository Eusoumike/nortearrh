import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { STATUS_LABEL, PRIORITY_LABEL, CHANNEL_LABEL, SLA_RESPONSE_HOURS, SLA_RESOLUTION_HOURS, type TicketPriority, type TicketChannel } from "@/lib/constants";
import { nowBrasilia, brazilInputToISO } from "@/lib/formatters";

export default function NewTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "media" as TicketPriority,
    channel: "portal" as TicketChannel,
    category: "",
    client_id: "" as string,
    opened_at: nowBrasilia(),
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, company").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const openedISO = brazilInputToISO(form.opened_at) ?? new Date().toISOString();
      const openedDate = new Date(openedISO);
      const respDeadline = new Date(openedDate.getTime() + SLA_RESPONSE_HOURS[form.priority] * 3600_000);
      const resDeadline = new Date(openedDate.getTime() + SLA_RESOLUTION_HOURS[form.priority] * 3600_000);
      const { data, error } = await supabase.from("tickets").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        channel: form.channel,
        category: form.category || null,
        client_id: form.client_id || null,
        created_by: user.id,
        created_at: openedISO,
        sla_response_deadline: respDeadline.toISOString(),
        sla_resolution_deadline: resDeadline.toISOString(),
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      toast.success(`Ticket #${data.ticket_number} criado.`);
      navigate(`/tickets/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo ticket</h1>
        <p className="text-sm text-muted-foreground">SLA será calculado automaticamente com base na prioridade.</p>
      </div>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Erro ao gerar relatório fiscal" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea id="desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhe o que está acontecendo, passos para reproduzir, impacto…" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente…" /></SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.company && <span className="text-muted-foreground">· {c.company}</span>}
                    </SelectItem>
                  ))}
                  {(clients ?? []).length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum cliente cadastrado ainda.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Financeiro, Bug, Dúvida…" />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade *</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">SLA: resposta {SLA_RESPONSE_HOURS[form.priority]}h · resolução {SLA_RESOLUTION_HOURS[form.priority]}h</p>
            </div>
            <div className="space-y-1.5">
              <Label>Canal *</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as TicketChannel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="opened_at">Data de abertura *</Label>
              <Input
                id="opened_at"
                type="datetime-local"
                required
                value={form.opened_at}
                onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">Horário de Brasília (GMT-3).</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !form.title} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar ticket
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
