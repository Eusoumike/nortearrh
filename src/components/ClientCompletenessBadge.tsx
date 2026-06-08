import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { computeCompleteness } from "@/lib/clientCompleteness";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  client: any;
  className?: string;
  compact?: boolean;
}

export function ClientCompletenessBadge({ client, className, compact }: Props) {
  const { score, level, missing } = computeCompleteness(client);
  const map = {
    complete: {
      label: "Cadastro completo",
      cls: "bg-success/10 text-success border-success/30",
      Icon: CheckCircle2,
    },
    partial: {
      label: "Cadastro parcial",
      cls: "bg-warning/10 text-warning border-warning/40",
      Icon: AlertTriangle,
    },
    incomplete: {
      label: "Cadastro incompleto",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
      Icon: XCircle,
    },
  }[level];
  const Icon = map.Icon;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        map.cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {compact ? `${score}%` : `${map.label} · ${score}%`}
    </span>
  );

  if (missing.length === 0) return badge;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="mb-1 font-medium">Faltando preencher:</p>
          <ul className="list-inside list-disc text-xs">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
