import { cn } from "@/lib/utils";
import { MODULO_AFETADO_COLORS, MODULO_AFETADO_LABEL } from "@/lib/constants";

interface Props {
  modulo?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function ModuloBadge({ modulo, size = "md", className }: Props) {
  if (!modulo) return null;
  const color = MODULO_AFETADO_COLORS[modulo] ?? "#6B7280";
  const label = MODULO_AFETADO_LABEL[modulo] ?? modulo;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium leading-none whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        className,
      )}
      style={{ backgroundColor: `${color}20`, color }}
      title={label}
    >
      {label}
    </span>
  );
}
