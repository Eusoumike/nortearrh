import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { TitleCategoryCombobox } from "@/components/TitleCategoryCombobox";
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

const CHANNEL_OPTIONS: { value: TicketChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "telefone", label: "Telefone" },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

const UNASSIGNED = "unassigned";

function maskPhone(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function addHoursToBrasiliaInput(localValue: string, hours: number): string {
  const iso = brazilInputToISO(localValue);
  if (!iso) return localValue;
  const future = new Date(new Date(iso).getTime() + hours * 3600_000);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(future);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const openedDefault = useMemo(() => nowBrasilia(), [open]);
  const slaDefault = useMemo(
    () => addHoursToBrasiliaInput(openedDefault, SLA_RESOLUTION_HOURS.media),
    [openedDefault],
  );

  const [form, setForm] = useState({
    ticket_number: "",
    title: "",
    description: "",
    client_id: "" as string,
    assigned_to: UNASSIGNED as string,
    organization: "",
    email: "",
    category: "",
    channel: "whatsapp" as TicketChannel,
    priority: "media" as TicketPriority,
    ticket_type: "" as TicketType | "",
    phone: "",
    anydesk: "",
    opened_at: openedDefault,
    sla_deadline: slaDefault,
  });
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // Reset on open + busca próximo número sequencial
  useEffect(() => {
    if (open) {
      const n = nowBrasilia();
      const sla = addHoursToBrasiliaInput(n, SLA_RESOLUTION_HOURS.media);

      // Busca o maior ticket_number numérico para sugerir o próximo
      (async () => {
        const { data } = await supabase
          .from("tickets")
          .select("ticket_number")
          .order("created_at", { ascending: false })
          .limit(200);
        let maxNum = 0;
        (data ?? []).forEach((t: any) => {
          const digits = String(t.ticket_number ?? "").replace(/\D/g, "");
          if (digits) {
            const n = parseInt(digits, 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
        });
        const next = String(maxNum + 1).padStart(3, "0");
        setForm((f) => ({ ...f, ticket_number: next }));
      })();

      setForm({
        ticket_number: "",
        title: "",
        description: "",
        client_id: "",
        assigned_to: UNASSIGNED,
        organization: "",
        email: "",
        category: "",
        channel: "whatsapp",
        priority: "media",
        ticket_type: "",
        phone: "",
        anydesk: "",
        opened_at: n,
        sla_deadline: sla,
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

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedClient = clients?.find((c) => c.id === form.client_id);
  const selectedAssignee = profiles?.find((p) => p.id === form.assigned_to);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const openedISO = brazilInputToISO(form.opened_at) ?? new Date().toISOString();
      const openedDate = new Date(openedISO);
      const respDeadline = new Date(openedDate.getTime() + SLA_RESPONSE_HOURS[form.priority] * 3600_000);
      const resDeadline = form.sla_deadline
        ? new Date(`${form.sla_deadline}T23:59:59-03:00`)
        : new Date(openedDate.getTime() + SLA_RESOLUTION_HOURS[form.priority] * 3600_000);

      const assignedTo = form.assigned_to === UNASSIGNED ? null : form.assigned_to;
      const assignedName = assignedTo
        ? profiles?.find((p) => p.id === assignedTo)?.full_name ?? null
        : null;

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          ticket_number: form.ticket_number.trim() || undefined,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          channel: form.channel,
          ticket_type: form.ticket_type as TicketType,
          category: form.category.trim() || null,
          client_id: form.client_id || null,
          client_phone: form.phone || null,
          client_email: form.email.trim() || null,
          organization: form.organization.trim() || null,
          anydesk_id: form.anydesk.trim() || null,
          assigned_to: assignedTo,
          assigned_name: assignedName,
          created_by: user.id,
          created_at: openedISO,
          opened_at: openedISO,
          sla_response_deadline: respDeadline.toISOString(),
          sla_resolution_deadline: resDeadline.toISOString(),
        } as any)
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
    form.title.trim() && form.client_id && form.channel && form.priority && form.ticket_type && form.opened_at;

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
      <DialogContent className="max-w-[760px] sm:max-w-[760px] p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="text-base">Novo Chamado</DialogTitle>
          <DialogDescription className="text-xs">
            Preencha os dados do atendimento. SLA de resposta calculado pela prioridade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-5 py-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {/* Número do chamado */}
            <div className="space-y-1">
              <Label htmlFor="ticket_number" className="text-xs">
                Número do chamado
              </Label>
              <Input
                id="ticket_number"
                value={form.ticket_number}
                onChange={(e) => setForm({ ...form, ticket_number: e.target.value })}
                placeholder="Ex: 031, VR-2024-001"
                className="h-9 font-mono"
                maxLength={50}
              />
            </div>

            {/* Título */}
            <div className="space-y-1">
              <Label htmlFor="title" className="text-xs">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Resumo do chamado"
                className="h-9"
                maxLength={200}
              />
            </div>

            {/* Tipo de chamado */}
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

            {/* Cliente | Atendente */}
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
                value={form.assigned_to}
                onValueChange={(v) => setForm({ ...form, assigned_to: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Não atribuído</SelectItem>
                  {(profiles ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Organização | Email */}
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

            {/* Telefone | Categoria */}
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                placeholder="(11) 99999-9999"
                className="h-9"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category" className="text-xs">Categoria</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex: Folha, Benefícios…"
                className="h-9"
                maxLength={100}
              />
            </div>

            {/* Canal | Prioridade */}
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

            {/* AnyDesk (linha sozinha, depois data abertura/sla) */}
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

            {/* Prazo SLA (full row pra alinhar) */}
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
            <div />

            {/* Descrição (opcional, full width) */}
            <div className="col-span-2 space-y-1">
              <Label htmlFor="description" className="text-xs">Descrição do problema</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes adicionais — o que o cliente relatou, contexto, prints, etc. (opcional)"
                rows={4}
                maxLength={2000}
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
