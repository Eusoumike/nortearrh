import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
  /** Cor do texto. Default usa currentColor — funciona em sidebar dark e em light. */
  textClassName?: string;
}

const SIZE = {
  sm: { box: "h-7 w-7", icon: 16, text: "text-lg" },
  md: { box: "h-9 w-9", icon: 20, text: "text-xl" },
  lg: { box: "h-11 w-11", icon: 24, text: "text-2xl" },
};

/**
 * Logo Nortear: bússola arredondada em fundo Teal Âncora
 * + wordmark "Nor" regular + "tear" itálico em Instrument Serif.
 */
export function NortearLogo({ className, iconOnly = false, size = "md", textClassName }: Props) {
  const s = SIZE[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex items-center justify-center rounded-xl shadow-sm",
          s.box,
        )}
        style={{ backgroundColor: "hsl(181 78% 25%)" }}
        aria-hidden="true"
      >
        <CompassIcon size={s.icon} />
      </span>
      {!iconOnly && (
        <span
          className={cn(
            "font-display leading-none tracking-tight",
            s.text,
            textClassName,
          )}
        >
          <span>Nor</span>
          <span className="italic">tear</span>
        </span>
      )}
    </div>
  );
}

function CompassIcon({ size = 20 }: { size?: number }) {
  // Bússola arredondada — simples e elegante, em creme/areia
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="hsl(39 26% 96%)" strokeWidth="1.6" />
      <path
        d="M12 6.5 L13.6 12 L12 17.5 L10.4 12 Z"
        fill="hsl(39 26% 96%)"
      />
      <circle cx="12" cy="12" r="1.1" fill="hsl(181 78% 25%)" />
    </svg>
  );
}
