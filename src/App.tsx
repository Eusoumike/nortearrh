import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import NewTicket from "./pages/NewTicket";
import TicketDetail from "./pages/TicketDetail";
import MyTasks from "./pages/MyTasks";
import Implantacao from "./pages/Implantacao";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={200}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/novo" element={<NewTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/tarefas" element={<MyTasks />} />
            <Route path="/implantacao" element={<Implantacao />} />
            <Route path="/clientes" element={<Clients />} />
            <Route path="/clientes/:id" element={<ClientDetail />} />
            <Route path="/inbox" element={<ComingSoon title="Caixa de entrada" description="Centralizador de e-mails, WhatsApp e chat. Chega na Onda 2." />} />
            <Route path="/performance" element={<ComingSoon title="Performance" description="Métricas por agente, ranking e tempo de resolução. Onda 2." />} />
            <Route path="/configuracoes" element={<ComingSoon title="Configurações" description="SLA, integrações Pipedrive/WhatsApp, gestão de usuários. Onda 2/3." />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
