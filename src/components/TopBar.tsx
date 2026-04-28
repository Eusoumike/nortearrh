import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, Plus, Bell, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NewTicketDialog } from "@/components/NewTicketDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { timeAgo } from "@/lib/formatters";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";


export function TopBar() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Atalho ⌘K / Ctrl+K abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("hub-theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("hub-theme", next ? "dark" : "light");
  };

  // SLA alerts (live): tickets abertos com sla_resolution_deadline,
  // estourados OU com ≥80% do prazo consumido
  const { data: alerts } = useQuery({
    queryKey: ["sla-alerts-live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_number, title, sla_resolution_deadline, status, created_at")
        .in("status", ["novo", "em_atendimento", "aguardando_cliente", "suporte_vera_n1", "abertura_chamado_n2"])
        .not("sla_resolution_deadline", "is", null)
        .order("sla_resolution_deadline", { ascending: true })
        .limit(50);
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter((t: any) => {
        const deadline = new Date(t.sla_resolution_deadline).getTime();
        if (now >= deadline) return true;
        const created = new Date(t.created_at).getTime();
        const total = deadline - created;
        if (total <= 0) return false;
        return (now - created) / total >= 0.8;
      }).slice(0, 10);
    },
    refetchInterval: 60_000,
  });

  // Realtime: refetch alerts when tickets change
  useEffect(() => {
    const channel = supabase
      .channel("tickets-sla-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          qc.invalidateQueries({ queryKey: ["sla-alerts-live"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const alertCount = alerts?.length ?? 0;

  // Busca global: tickets (título, #número, cliente, empresa)
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["global-search", debouncedTerm],
    enabled: searchOpen && debouncedTerm.length >= 2,
    queryFn: async () => {
      const safe = debouncedTerm.replace(/[%_,()]/g, " ").trim();
      const numeric = safe.replace(/^#/, "");
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_number, title, status, client_name, organization, client:clients(name, company)")
        .or(
          `title.ilike.%${safe}%,ticket_number.ilike.%${numeric}%,client_name.ilike.%${safe}%,organization.ilike.%${safe}%`,
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const goToTicket = (ticketId: string) => {
    setSearchOpen(false);
    setSearchTerm("");
    navigate(`/tickets/${ticketId}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md md:px-4">
      <SidebarTrigger className="h-8 w-8" />
      <div className="hidden md:flex flex-1 max-w-md">
        <button
          onClick={() => setSearchOpen(true)}
          className="group inline-flex w-full items-center gap-2 rounded-md border border-input bg-surface-muted px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Buscar tickets, clientes, empresas…</span>
          <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} title="Trocar tema">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8" title="Alertas SLA">
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-warning-foreground">
                  {alertCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b border-border px-3 py-2">
              <p className="text-sm font-semibold">Alertas de SLA</p>
              <p className="text-xs text-muted-foreground">Chamados com mais de 80% do prazo consumido.</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {alertCount === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum alerta ativo.</p>
              ) : (
                <div className="divide-y divide-border">
                  {alerts!.map((a: any) => (
                    <Link key={a.id} to={`/tickets/${a.id}`} className="block px-3 py-2 hover:bg-surface-muted">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">#{a.ticket_number}</span>
                        <p className="flex-1 truncate text-xs font-medium">{a.title}</p>
                      </div>
                      {a.sla_resolution_deadline && (
                        <p className="text-[10px] text-muted-foreground">vence {timeAgo(a.sla_resolution_deadline)}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button size="sm" className="ml-1 h-8 gap-1.5 bg-gradient-brand px-2 text-primary-foreground shadow-sm hover:opacity-90 sm:ml-2 sm:px-3" onClick={() => setNewTicketOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Novo chamado</span>
        </Button>
      </div>
      <NewTicketDialog open={newTicketOpen} onOpenChange={setNewTicketOpen} />
    </header>
  );
}
