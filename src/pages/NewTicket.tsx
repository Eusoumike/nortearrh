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
import { TemaAutocomplete } from "@/components/tickets/TemaAutocomplete";
import {
  PRIORITY_LABEL,
  CHANNEL_LABEL,
  SLA_RESPONSE_HOURS,
  SLA_RESOLUTION_HOURS,
  MODULO_AFETADO_OPTIONS,
  QUEM_REPORTOU_OPTIONS,
  type TicketPriority,
  type TicketChannel,
} from "@/lib/constants";
import { nowBrasilia, brazilInputToISO } from "@/lib/formatters";

export default function NewTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    tema: "",
    modulo_afetado: "",
    quem_reportou: "",
    descricao_problema: "",
    priority: "media" as TicketPriority,
    channel: "whatsapp" as TicketChannel,
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
      if (!form.tema.trim()) throw new Error("Tema é obrigatório");
      if (!form.modulo_afetado) throw new Error("Módulo afetado é obrigatório");
      if (!form.descricao_problema.trim()) throw new Error("Descrição é obrigatória");

      const openedISO = brazilInputToISO(form.opened_at) ?? new Date().toISOString();
      const openedDate = new Date(openedISO);
      const respDeadline = new Date(openedDate.getTime() + SLA_RESPONSE_HOURS[form.priority] * 3600_000);
      const resDeadline = new Date(openedDate.getTime() + SLA_RESOLUTION_HOURS[form.priority] * 3600_000);
      const { data, error } = await supabase.from("tickets").insert({
        title: form.tema.trim(),
        tema: form.tema.trim(),
        modulo_afetado: form.modulo_afetado,
        quem_reportou: form.quem_reportou || null,
        descricao_problema: form.descricao_problema.trim(),
        priority: form.priority,
        channel: form.channel,
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
      qc.invalidateQueries({ queryKey: ["temas-frequentes"] });
      toast.success(`Ticket #${data.ticket_number} criado.`);
      navigate(`/tickets/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const requiredOk =
    form.tema.trim() && form.modulo_afetado && form.descricao_problema.trim();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo chamado</h1>
        <p className="text-sm text-muted-foreground">SLA calculado automaticamente com base na prioridade.</p>
      </div>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="space-y-1.5">
            <Label>Tema *</Label>
            <TemaAutocomplete
              value={form.tema}
              onChange={(tema, moduloSugerido) =>
                setForm((f) => ({
                  ...f,
                  tema,
                  modulo_afetado: f.modulo_afetado || moduloSugerido || f.modulo_afetado,
                }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Módulo afetado *</Label>
              <Select
                value={form.modulo_afetado || undefined}
                onValueChange={(v) => setForm({ ...form, modulo_afetado: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MODULO_AFETADO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quem reportou</Label>
              <Select
                value={form.quem_reportou || undefined}
                onValueChange={(v) => setForm({ ...form, quem_reportou: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {QUEM_REPORTOU_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição do problema *</Label>
            <Textarea
              id="desc"
              rows={4}
              value={form.descricao_problema}
              onChange={(e) => setForm({ ...form, descricao_problema: e.target.value })}
              placeholder="Descreva o problema em detalhes, passos para reproduzir e impacto…"
            />
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
            <div className="space-y-1.5">
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
            <Button type="submit" disabled={create.isPending || !requiredOk} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar chamado
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
