import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAutoCloseTickets } from "@/hooks/useAutoCloseTickets";

export function AppLayout() {
  const { user } = useAuth();
  // Verifica chamados em "aguardando_cliente" há mais de 24h sem retorno
  // a cada 30 minutos (apenas com usuário autenticado).
  useAutoCloseTickets(!!user);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          {/*
            min-h-0 + flex-col allows full-height children (kanbans use h-full + overflow-hidden).
            Pages that need vertical scroll wrap their own content; the Outlet itself fills available height.
          */}
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
