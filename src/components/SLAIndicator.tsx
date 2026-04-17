import { useEffect, useState } from "react";
import { slaStatus, formatDuration } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface SLAIndicatorProps {
  deadline: string | null | undefined;
  size?: "sm" | "md" | "lg";
  label?: string;
  resolved?: boolean;
  className?: string;
}

export function SLAIndicator({ deadline, size = "md", label, resolved, className }: SLAIndicatorProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  if (resolved) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-success", className)}>
        <CheckCircle2 className="h-3.5 w-3.5" /> SLA cumprido
      </span>
    );
  }

  if (!deadline) return null;
  const { state, remaining } = slaStatus(deadline, now);
  const config = {
    none:      { color: "text-muted-foreground", bg: "bg-muted", icon: Clock,           pulse: false },
    ok:        { color: "text-success",          bg: "bg-success/10", icon: Clock,      pulse: false },
    atencao:   { color: "text-warning",          bg: "bg-warning/15", icon: Clock,      pulse: false },
    critico:   { color: "text-danger",           bg: "bg-danger/15", icon: AlertTriangle, pulse: true },
    estourado: { color: "text-danger",           bg: "bg-danger/20", icon: AlertTriangle, pulse: true },
  }[state];

  const Icon = config.icon;
  const sizing = size === "sm" ? "text-[11px] px-2 py-0.5" : size === "lg" ? "text-sm px-3 py-1.5" : "text-xs px-2.5 py-1";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md font-mono font-medium", config.bg, config.color, sizing, config.pulse && "animate-sla-pulse", className)}>
      <Icon className="h-3.5 w-3.5" />
      {label && <span className="font-sans font-normal opacity-70 mr-1">{label}</span>}
      {state === "estourado" ? `Estourado ${formatDuration(remaining).replace("-", "")}` : formatDuration(remaining)}
    </span>
  );
}
