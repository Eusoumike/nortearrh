import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toneBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground border-border",
        muted: "bg-muted/60 text-muted-foreground border-border/60",
        info: "bg-info/10 text-info border-info/20",
        success: "bg-success/10 text-success border-success/20",
        warning: "bg-warning/15 text-warning-foreground border-warning/30 dark:text-warning",
        danger: "bg-danger/10 text-danger border-danger/20",
        accent: "bg-accent/15 text-accent-foreground border-accent/30 dark:text-accent",
        primary: "bg-primary/10 text-primary border-primary/20",
      } as Record<string, string>,
      size: {
        sm: "text-[10px] px-1.5 py-0.5",
        md: "text-xs px-2 py-0.5",
        lg: "text-sm px-2.5 py-1",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  }
);

export interface ToneBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof toneBadgeVariants> {
  dot?: boolean;
}

export function ToneBadge({ className, tone, size, dot, children, ...props }: ToneBadgeProps) {
  return (
    <span className={cn(toneBadgeVariants({ tone, size }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
