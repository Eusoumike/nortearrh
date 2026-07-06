import { useState, useCallback } from "react";

export interface TicketAlvoEncerramento {
  id: string;
  ticket_number?: string | null;
  title?: string | null;
  tema?: string | null;
  description?: string | null;
  descricao_problema?: string | null;
  modulo_afetado?: string | null;
  status?: string | null;
}

export function useEncerrarChamado() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [ticketAlvo, setTicketAlvo] = useState<TicketAlvoEncerramento | null>(null);

  const abrirModal = useCallback((ticket: TicketAlvoEncerramento) => {
    setTicketAlvo(ticket);
    setDialogAberto(true);
  }, []);

  const fecharModal = useCallback(() => {
    setDialogAberto(false);
    setTimeout(() => setTicketAlvo(null), 200);
  }, []);

  return { dialogAberto, ticketAlvo, abrirModal, fecharModal };
}
