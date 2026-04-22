import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const AUTO_CLOSE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h
const WARN_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h

interface Props {
  status: string;
  enteredAt: string | null | undefined;
  /** Última interação (qualquer uma) feita após enteredAt — se houver, não fecha. */
  lastInteractionAt?: string | null;
  variant?: "card" | "full";
  className?: string;
}

/**
 * Aviso âmbar de fechamento automático em "Aguardando cliente".
 * Aparece quando faltam menos de 2h para o fechamento (24h sem retorno).
 */
export function AutoCloseWarning({
  status,
  enteredAt,
  lastInteractionAt,
  variant = "full",
  className,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);

  if (status !== "aguardando_cliente" || !enteredAt) return null;

  const enteredMs = new Date(enteredAt).getTime();
  // Se houve interação após entrar no estágio, o cron NÃO fecha — não avisa.
  if (lastInteractionAt && new Date(lastInteractionAt).getTime() > enteredMs) {
    return null;
  }

  const remaining = enteredMs + AUTO_CLOSE_AFTER_MS - now;
  if (remaining <= 0 || remaining > WARN_THRESHOLD_MS) return null;

  const totalMin = Math.max(0, Math.floor(remaining / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const remainingLabel = h > 0 ? `${h}h ${m}min` : `${m}min`;

  if (variant === "card") {
    return (
      <div
        className={cn(
          "mt-1.5 flex items-center gap-1 rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400",
          className,
        )}
        title={`Fecha automaticamente em ${remainingLabel} se não houver retorno`}
      >
        <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">Fecha em {remainingLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <span className="mr-1">⚠️</span>
        Fecha automaticamente em <strong>{remainingLabel}</strong> se não houver
        retorno do cliente.
      </span>
    </div>
  );
}
