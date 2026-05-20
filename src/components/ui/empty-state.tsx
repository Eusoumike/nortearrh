import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode | { label: string; onClick: () => void; icon?: LucideIcon };
  className?: string;
}

function isActionObject(
  a: NonNullable<EmptyStateProps["action"]>,
): a is { label: string; onClick: () => void; icon?: LucideIcon } {
  return typeof a === "object" && a !== null && "label" in (a as any) && "onClick" in (a as any);
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-10 text-center", className)}>
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <Icon className="h-7 w-7" strokeWidth={1.5} />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action ? (
        isActionObject(action) ? (
          <Button size="sm" onClick={action.onClick} className="mt-1">
            {action.icon && <action.icon className="h-3.5 w-3.5" />}
            {action.label}
          </Button>
        ) : (
          <div className="mt-1">{action}</div>
        )
      ) : null}
    </div>
  );
}
