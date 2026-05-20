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
import Performance from "./pages/Performance";
import CrmPipeline from "./pages/CrmPipeline";
import CrmDealDetail from "./pages/CrmDealDetail";
import CrmActivities from "./pages/CrmActivities";
import CrmAnalytics from "./pages/CrmAnalytics";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import ComingSoon from "./pages/ComingSoon";
import Settings from "./pages/Settings";
import Financeiro from "./pages/Financeiro";
import Nps from "./pages/Nps";
import NpsForm from "./pages/NpsForm";
import NotFound from "./pages/NotFound.tsx";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pesquisa" element={<NpsForm />} />
          <Route path="/pesquisa/:token" element={<NpsForm />} />
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
            <Route path="/performance" element={<Performance />} />
            <Route path="/crm" element={<CrmPipeline />} />
            <Route path="/crm/pipeline" element={<CrmPipeline />} />
            <Route path="/nps" element={<Nps />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/configuracoes" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
