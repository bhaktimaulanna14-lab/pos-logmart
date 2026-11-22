import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  variant?: "full" | "icon";
  className?: string;
};

const sizes = {
  sm: { log: "text-2xl", mart: "text-lg px-2.5 py-0.5", branch: "text-[11px]", tagline: "text-[10px]", gap: "gap-1" },
  md: { log: "text-3xl", mart: "text-xl px-3 py-0.5", branch: "text-sm", tagline: "text-xs", gap: "gap-1.5" },
  lg: { log: "text-5xl", mart: "text-3xl px-4 py-1", branch: "text-xl", tagline: "text-base", gap: "gap-2" },
};

/**
 * LOGMart wordmark rebuilt in code: green-gradient "LOG",
 * orange "Mart" badge with a curled top-right tail, optional tagline.
 */
export function Logo({ size = "md", showTagline = false, variant = "full", className }: LogoProps) {
  if (variant === "icon") return <LogoIcon className={className} />;

  const s = sizes[size];
  return (
    <div className={cn("inline-flex flex-col items-center select-none font-brand", className)}>
      <div className={cn("flex items-center", s.gap)}>
        <span className={cn("text-brand-gradient font-black italic tracking-tight leading-none pr-0.5", s.log)}>
          LOG
        </span>
        <span
          className={cn(
            "relative bg-brand-orange-gradient text-white font-extrabold italic leading-tight",
            "rounded-l-lg rounded-br-lg rounded-tr-[1.25em] shadow-sm shadow-orange-500/30 -skew-x-6",
            s.mart
          )}
        >
          <span className="inline-block skew-x-6">Mart</span>
        </span>
      </div>
      <span className={cn("mt-1 font-extrabold text-brand-green tracking-[0.35em] pl-[0.35em] leading-none", s.branch)}>
        TROWONO
      </span>
      {showTagline && (
        <span className={cn("mt-1 font-semibold italic text-brand-ink tracking-wide", s.tagline)}>
          Solusi Belanja Murah
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand-gradient text-white font-brand font-black italic text-lg shadow-sm",
        className
      )}
    >
      L
      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand-orange-gradient ring-2 ring-white" />
    </div>
  );
}
