import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Search, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SLA_RESPONSE_HOURS,
  SLA_RESOLUTION_HOURS,
  TICKET_TYPE_GROUPS,
  TICKET_TYPE_LABEL,
  type TicketPriority,
  type TicketChannel,
  type TicketType,
} from "@/lib/constants";
import { SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { nowBrasilia, brazilInputToISO } from "@/lib/formatters";

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Canais reduzidos conforme especificação do modal
const CHANNEL_OPTIONS: { value: TicketChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "telefone", label: "Telefone" },
];

// Prioridades reduzidas (sem "crítica" no modal rápido)
const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

// Máscara (11) 99999-9999
function maskPhone(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const now = useMemo(() => new Date(), [open]);
  const defaultSla = useMemo(() => {
    const d = new Date(now.getTime() + SLA_RESOLUTION_HOURS.media * 3600_000);
    return d;
  }, [now]);

  const [form, setForm] = useState({
    title: "",
    client_id: "" as string,
    client_search: "",
    assignee: "Nortear",
    organization: "",
    email: "",
    channel: "whatsapp" as TicketChannel,
    priority: "media" as TicketPriority,
    ticket_type: "" as TicketType | "",
    phone: "",
    anydesk: "",
    opened_at: toLocalInputValue(now),
    sla_deadline: toLocalDateValue(defaultSla),
  });
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      const n = new Date();
      const sla = new Date(n.getTime() + SLA_RESOLUTION_HOURS.media * 3600_000);
      setForm({
        title: "",
        client_id: "",
        client_search: "",
        assignee: "Nortear",
        organization: "",
        email: "",
        channel: "whatsapp",
        priority: "media",
        ticket_type: "",
        phone: "",
        anydesk: "",
        opened_at: toLocalInputValue(n),
        sla_deadline: toLocalDateValue(sla),
      });
    }
  }, [open]);

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, email, phone")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedClient = clients?.find((c) => c.id === form.client_id);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const opened = new Date(form.opened_at);
      const respDeadline = new Date(opened.getTime() + SLA_RESPONSE_HOURS[form.priority] * 3600_000);
      const resDeadline = form.sla_deadline
        ? new Date(`${form.sla_deadline}T23:59:59`)
        : new Date(opened.getTime() + SLA_RESOLUTION_HOURS[form.priority] * 3600_000);

      const metadataNote = [
        form.anydesk ? `AnyDesk: ${form.anydesk}` : null,
        form.phone ? `Telefone: ${form.phone}` : null,
        form.email && !selectedClient?.email ? `Email: ${form.email}` : null,
        form.organization && !selectedClient?.company ? `Organização: ${form.organization}` : null,
        form.assignee ? `Responsável: ${form.assignee}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title: form.title,
          description: metadataNote || null,
          priority: form.priority,
          channel: form.channel,
          ticket_type: form.ticket_type as TicketType,
          client_id: form.client_id || null,
          created_by: user.id,
          created_at: opened.toISOString(),
          sla_response_deadline: respDeadline.toISOString(),
          sla_resolution_deadline: resDeadline.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      toast.success(`Chamado #${data.ticket_number} criado.`);
      onOpenChange(false);
      navigate(`/tickets/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const requiredOk =
    form.title.trim() && form.client_id && form.channel && form.priority && form.ticket_type && form.phone && form.opened_at;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiredOk) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] sm:max-w-[760px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="text-base">Novo Chamado</DialogTitle>
          <DialogDescription className="text-xs">
            Preencha os dados do atendimento. SLA de resposta calculado pela prioridade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {/* Linha 1 — Título */}
            <div className="col-span-2 space-y-1">
              <Label htmlFor="title" className="text-xs">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Descreva o chamado"
                className="h-9"
                maxLength={200}
              />
            </div>

            {/* Linha 1.5 — Tipo de chamado (full width) */}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">
                Tipo de chamado <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.ticket_type || undefined}
                onValueChange={(v) => setForm({ ...form, ticket_type: v as TicketType })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o tipo de chamado" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px]">
                  {TICKET_TYPE_GROUPS.map((group, idx) => (
                    <div key={group.label}>
                      {idx > 0 && <SelectSeparator />}
                      <SelectGroup>
                        <SelectLabel className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                          <span>{group.label}</span>
                          <span className="font-normal text-muted-foreground normal-case tracking-normal">{group.hint}</span>
                        </SelectLabel>
                        {group.types.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TICKET_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linha 2 — Cliente | Atendente */}
            <div className="space-y-1">
              <Label className="text-xs">
                Cliente <span className="text-destructive">*</span>
              </Label>
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "h-9 w-full justify-between font-normal",
                      !selectedClient && "text-muted-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Search className="h-3.5 w-3.5 shrink-0" />
                      {selectedClient ? selectedClient.name : "Nome do cliente"}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente…" className="h-9" />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {(clients ?? []).map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.company ?? ""} ${c.email ?? ""}`}
                            onSelect={() => {
                              setForm((prev) => ({
                                ...prev,
                                client_id: c.id,
                                client_search: c.name,
                                organization: c.company ?? prev.organization,
                                email: c.email ?? prev.email,
                                phone: c.phone ? maskPhone(c.phone) : prev.phone,
                              }));
                              setClientPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                form.client_id === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{c.name}</span>
                              {c.company && (
                                <span className="text-xs text-muted-foreground">{c.company}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Atendente Responsável</Label>
              <Select
                value={form.assignee}
                onValueChange={(v) => setForm({ ...form, assignee: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nortear">Nortear</SelectItem>
                  <SelectItem value="Não atribuído">Não atribuído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Linha 3 — Organização | Email */}
            <div className="space-y-1">
              <Label htmlFor="org" className="text-xs">Organização</Label>
              <Input
                id="org"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                placeholder="Empresa"
                className="h-9"
                maxLength={150}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@empresa.com"
                className="h-9"
                maxLength={150}
              />
            </div>

            {/* Linha 4 — Canal | Prioridade */}
            <div className="space-y-1">
              <Label className="text-xs">
                Canal <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.channel}
                onValueChange={(v) => setForm({ ...form, channel: v as TicketChannel })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Prioridade <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linha 5 — Telefone | AnyDesk */}
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">
                Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                placeholder="(11) 99999-9999"
                className="h-9"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="anydesk" className="text-xs">AnyDesk do Cliente</Label>
              <Input
                id="anydesk"
                value={form.anydesk}
                onChange={(e) => setForm({ ...form, anydesk: e.target.value })}
                placeholder="123 456 789"
                className="h-9"
                maxLength={50}
              />
            </div>

            {/* Linha 6 — Data Abertura | Prazo SLA */}
            <div className="space-y-1">
              <Label htmlFor="opened" className="text-xs">
                Data de Abertura <span className="text-destructive">*</span>
              </Label>
              <Input
                id="opened"
                type="datetime-local"
                required
                value={form.opened_at}
                onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sla" className="text-xs">Prazo SLA</Label>
              <Input
                id="sla"
                type="date"
                value={form.sla_deadline}
                onChange={(e) => setForm({ ...form, sla_deadline: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-3 -mx-5 px-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !requiredOk}
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Chamado
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
