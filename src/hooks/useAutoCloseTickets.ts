import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const AUTO_CLOSE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const STORAGE_KEY = "auto-close-last-run";
const MIN_RUN_GAP_MS = 25 * 60 * 1000; // evita rodar duas vezes em abas diferentes

async function runAutoClose() {
  try {
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - last < MIN_RUN_GAP_MS) return;
    localStorage.setItem(STORAGE_KEY, String(Date.now()));

    const { data, error } = await supabase.functions.invoke(
      "auto-close-waiting-tickets",
    );
    if (error) {
      console.warn("[auto-close] erro ao invocar:", error.message);
      return;
    }
    if (data?.closed > 0) {
      console.info(
        `[auto-close] ${data.closed} chamado(s) encerrado(s) por inatividade.`,
      );
    }
  } catch (e) {
    console.warn("[auto-close] exceção:", e);
  }
}

/**
 * Dispara a verificação de fechamento automático de chamados em "aguardando_cliente"
 * a cada 30 minutos enquanto houver um usuário autenticado com o app aberto.
 */
export function useAutoCloseTickets(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    // Roda uma vez ao montar
    runAutoClose();

    const intervalId = window.setInterval(runAutoClose, AUTO_CLOSE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled]);
}
