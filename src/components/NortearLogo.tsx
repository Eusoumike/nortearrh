import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
  /** Cor do texto. Default usa currentColor — funciona em sidebar dark e em light. */
  textClassName?: string;
}

const SIZE = {
  sm: { box: "h-8 w-8", icon: 18, text: "text-[18px]" },
  md: { box: "h-10 w-10", icon: 22, text: "text-2xl" },
  lg: { box: "h-12 w-12", icon: 26, text: "text-3xl" },
};

/**
 * Logo Nortear: bússola arredondada em fundo Teal de destaque (#3D7A7A)
 * + wordmark "Nor" regular + "tear" itálico em Instrument Serif, em creme #F2EFE9.
 */
export function NortearLogo({ className, iconOnly = false, size = "sm", textClassName }: Props) {
  const s = SIZE[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn("flex items-center justify-center shadow-sm", s.box)}
        style={{ backgroundColor: "#3D7A7A", borderRadius: "30%" }}
        aria-hidden="true"
      >
        <CompassIcon size={s.icon} />
      </span>
      {!iconOnly && (
        <span
          className={cn("font-display leading-none tracking-tight", s.text, textClassName)}
          style={{ color: textClassName ? undefined : "#F2EFE9" }}
        >
          <span>Nor</span>
          <span className="italic">tear</span>
        </span>
      )}
    </div>
  );
}

function CompassIcon({ size = 22 }: { size?: number }) {
  // Bússola apontando para cima — losango com agulha norte destacada
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="#F2EFE9" strokeWidth="1.6" />
      {/* Agulha (norte = creme cheio, sul = traço) */}
      <path d="M12 5.5 L13.8 12 L12 11 L10.2 12 Z" fill="#F2EFE9" />
      <path d="M12 18.5 L10.2 12 L12 13 L13.8 12 Z" fill="#F2EFE9" fillOpacity="0.4" />
      <circle cx="12" cy="12" r="1.1" fill="#3D7A7A" />
    </svg>
  );
}
