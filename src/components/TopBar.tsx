import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, Plus, Bell, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function TopBar() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const navigate = useNavigate();

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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md md:px-4">
      <SidebarTrigger className="h-8 w-8" />
      <div className="hidden md:flex flex-1 max-w-md">
        <button
          onClick={() => navigate("/tickets")}
          className="group inline-flex w-full items-center gap-2 rounded-md border border-input bg-surface-muted px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Buscar tickets, clientes, agentes…</span>
          <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} title="Trocar tema">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
        <Button size="sm" className="ml-2 h-8 gap-1.5 bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90" onClick={() => navigate("/tickets/novo")}>
          <Plus className="h-3.5 w-3.5" /> Novo ticket
        </Button>
      </div>
    </header>
  );
}
