import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TitleCategoryCombobox } from "@/components/TitleCategoryCombobox";
import {
  STATUS_LABEL,
  STATUS_FLOW,
  PRIORITY_LABEL,
  CHANNEL_LABEL,
  TICKET_TYPE_GROUPS,
  TICKET_TYPE_LABEL,
  type TicketStatus,
  type TicketPriority,
  type TicketChannel,
  type TicketType,
} from "@/lib/constants";
import { brazilInputToISO, formatBrazilDateTime } from "@/lib/formatters";

interface EditTicketDialogProps {
  ticket: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Converte ISO UTC em string `YYYY-MM-DDTHH:mm` no fuso de Brasília. */
function isoToBrasiliaInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function EditTicketDialog({ ticket, open, onOpenChange }: EditTicketDialogProps) {
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, company").order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const [form, setForm] = useState({
    ticket_number: "",
    title: "",
    client_id: "" as string,
    organization: "",
    client_email: "",
    client_phone: "",
    channel: "portal" as TicketChannel,
    status: "novo" as TicketStatus,
    priority: "media" as TicketPriority,
    category: "",
    ticket_type: "" as string,
    assigned_to: "unassigned" as string,
    opened_at: "",
    anydesk_id: "",
  });

  // Sincroniza form quando dialog abre / ticket muda
  useEffect(() => {
    if (!open || !ticket) return;
    setForm({
      ticket_number: String(ticket.ticket_number ?? ""),
      title: ticket.title ?? "",
      client_id: ticket.client_id ?? "",
      organization: ticket.organization ?? "",
      client_email: ticket.client_email ?? "",
      client_phone: ticket.client_phone ?? "",
      channel: ticket.channel ?? "portal",
      status: ticket.status ?? "novo",
      priority: ticket.priority ?? "media",
      category: ticket.category ?? "",
      ticket_type: ticket.ticket_type ?? "",
      assigned_to: ticket.assigned_to ?? "unassigned",
      opened_at: isoToBrasiliaInput(ticket.opened_at ?? ticket.created_at),
      anydesk_id: ticket.anydesk_id ?? "",
    });
  }, [open, ticket]);

  const save = useMutation({
    mutationFn: async () => {
      const numberTrim = form.ticket_number.trim();
      if (!numberTrim) throw new Error("Número do chamado é obrigatório.");
      if (!form.title.trim()) throw new Error("Título é obrigatório.");

      const patch: Record<string, any> = {
        ticket_number: numberTrim,
        title: form.title.trim(),
        client_id: form.client_id || null,
        organization: form.organization.trim() || null,
        client_email: form.client_email.trim() || null,
        client_phone: form.client_phone.trim() || null,
        channel: form.channel,
        status: form.status,
        priority: form.priority,
        category: form.category.trim() || null,
        ticket_type: form.ticket_type || null,
        assigned_to: form.assigned_to === "unassigned" ? null : form.assigned_to,
        opened_at: brazilInputToISO(form.opened_at) ?? ticket.opened_at,
        anydesk_id: form.anydesk_id.trim() || null,
      };

      const { error } = await supabase.from("tickets").update(patch as any).eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      toast.success("Chamado atualizado.");
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = String(e.message ?? "");
      if (msg.includes("unique") || msg.includes("duplicate")) {
        toast.error("Já existe um chamado com esse número.");
      } else {
        toast.error(msg || "Erro ao atualizar.");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar chamado</DialogTitle>
          <DialogDescription>
            Atualize qualquer campo do chamado. O número aceita letras e dígitos (ex: VR-2024-001).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ticket_number">Número *</Label>
              <Input
                id="ticket_number"
                value={form.ticket_number}
                onChange={(e) => setForm({ ...form, ticket_number: e.target.value })}
                placeholder="VR-2024-001"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Título *</Label>
              <TitleCategoryCombobox
                id="title"
                required
                value={form.title}
                onChange={(v) => setForm((f) => ({ ...f, title: v }))}
                onCategorySelected={(cat) =>
                  setForm((f) => ({ ...f, category: cat?.name ?? f.category }))
                }
                placeholder="Comece a digitar para ver classificações…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={form.client_id || "none"}
                onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {(clients ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.company ? ` · ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="organization">Organização</Label>
              <Input
                id="organization"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                maxLength={200}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="client_email">Email</Label>
              <Input
                id="client_email"
                type="email"
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client_phone">Telefone</Label>
              <Input
                id="client_phone"
                value={form.client_phone}
                onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                maxLength={30}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as TicketChannel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TicketStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map((k) => (
                    <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de chamado</Label>
              <Select
                value={form.ticket_type || "none"}
                onValueChange={(v) => setForm({ ...form, ticket_type: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Classificar" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="none">— Sem tipo —</SelectItem>
                  {TICKET_TYPE_GROUPS.map((group, idx) => (
                    <div key={group.label}>
                      {idx >= 0 && <SelectSeparator />}
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wider">{group.label}</SelectLabel>
                        {group.types.map((t) => (
                          <SelectItem key={t} value={t}>{TICKET_TYPE_LABEL[t]}</SelectItem>
                        ))}
                      </SelectGroup>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Atendente responsável</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {(profiles ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opened_at">
                Data de abertura <span className="text-[10px] text-muted-foreground">(Brasília)</span>
              </Label>
              <Input
                id="opened_at"
                type="datetime-local"
                value={form.opened_at}
                onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Atual: {formatBrazilDateTime(ticket?.opened_at ?? ticket?.created_at)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anydesk_id">AnyDesk ID</Label>
            <Input
              id="anydesk_id"
              value={form.anydesk_id}
              onChange={(e) => setForm({ ...form, anydesk_id: e.target.value })}
              maxLength={50}
              placeholder="123 456 789"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
