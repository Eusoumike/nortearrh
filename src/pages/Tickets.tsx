import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Filter } from "lucide-react";
import { STATUS_LABEL, STATUS_FLOW, PRIORITY_LABEL, type TicketStatus, type TicketPriority } from "@/lib/constants";
import { NewTicketDialog } from "@/components/NewTicketDialog";
import { TicketKanban } from "@/components/TicketKanban";

export default function Tickets() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [newTicketOpen, setNewTicketOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter, debouncedQ],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("*, client:clients(id, name), assignee:profiles!assigned_to(full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") query = query.eq("status", statusFilter as TicketStatus);
      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as TicketPriority);

      if (debouncedQ) {
        const safe = debouncedQ.replace(/[%_,()]/g, " ").trim();
        query = query.or(
          `title.ilike.%${safe}%,description.ilike.%${safe}%,ticket_number.ilike.%${safe}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filtered = tickets ?? [];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} ticket{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <Button onClick={() => setNewTicketOpen(true)} className="bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90">
          <Plus className="mr-1.5 h-4 w-4" /> Novo chamado
        </Button>
      </div>
      <NewTicketDialog open={newTicketOpen} onOpenChange={setNewTicketOpen} />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, descrição ou #número…" className="h-9 pl-8" />
          </div>
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_FLOW.map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-[60vh]" />
      ) : (
        <TicketKanban tickets={filtered as any} />
      )}
    </div>
  );
}
