import { cn } from "@/lib/utils";

export type StatusFilter = "todos" | "pendentes" | "pagos";

interface ChipDef {
  value: StatusFilter;
  label: string;
  icon?: string;
  count: number;
}

interface Props {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: { todos: number; pendentes: number; pagos: number };
  labels?: { pendentes?: string; pagos?: string };
}

export function StatusFilterChips({ value, onChange, counts, labels }: Props) {
  const chips: ChipDef[] = [
    { value: "todos", label: "Todos", count: counts.todos },
    {
      value: "pendentes",
      label: labels?.pendentes ?? "Pendentes",
      icon: "⏳",
      count: counts.pendentes,
    },
    {
      value: "pagos",
      label: labels?.pagos ?? "Pagos",
      icon: "✅",
      count: counts.pagos,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={cn(
              "rounded-full border px-4 py-1 text-sm transition-colors",
              !active && "border-border text-muted-foreground hover:bg-muted",
              active && c.value === "todos" && "bg-primary text-primary-foreground border-primary",
              active &&
                c.value === "pendentes" &&
                "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-200",
              active &&
                c.value === "pagos" &&
                "bg-green-100 border-green-300 text-green-800 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-200",
            )}
          >
            {c.icon ? `${c.icon} ` : ""}
            {c.label} ({c.count})
          </button>
        );
      })}
    </div>
  );
}
