import { cn } from "@/lib/utils";

/** Wellen-Mark — identisch zur Marketing-Seite und Anmeldung. */
export function EvglabMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn("evglab-mark", className)}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 22 Q10 12 16 20 T24 16"
        stroke="#E89259"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M2 18 Q7 6 14 14 T26 10" stroke="#C7691E" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
