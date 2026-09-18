"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchBillingState, type ClientBillingState } from "@/lib/billing/clientBootstrap";
import { cn } from "@/lib/utils";

export type BillingTokenSnapshot = {
  remaining: number;
  total: number;
  unlimited: boolean;
};

export function useBillingTokens(): BillingTokenSnapshot | null {
  const [snapshot, setSnapshot] = useState<BillingTokenSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (state: ClientBillingState | null) => {
      if (cancelled || !state) return;
      setSnapshot({
        remaining: state.remainingTokens,
        total: Math.max(state.monthlyTokens, 0),
        unlimited: Boolean(state.unlimited),
      });
    };

    const load = async () => {
      apply(await fetchBillingState());
    };

    void load();
    const onUpdate = () => void load();
    window.addEventListener("evglab-billing-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("evglab-billing-updated", onUpdate);
    };
  }, []);

  return snapshot;
}

/** Anteil verbleibender Tokens (1 = voll, 0 = leer). Unlimited = voller Ring. */
export function tokenRingProgress(snapshot: BillingTokenSnapshot | null): number {
  if (!snapshot) return 0;
  if (snapshot.unlimited) return 1;
  if (snapshot.total <= 0) return 0;
  return Math.min(1, Math.max(0, snapshot.remaining / snapshot.total));
}

type TokenAvatarRingProps = {
  children: ReactNode;
  className?: string;
  /** Gesamtdurchmesser inkl. Ring. */
  size?: number;
};

/**
 * Runder Marken-Ring um den Avatar — Bogenlänge = verbleibende Tokens.
 * overflow sichtbar, damit der Stroke nicht an Ecken abgeschnitten wird.
 */
export function TokenAvatarRing({ children, className, size = 36 }: TokenAvatarRingProps) {
  const snapshot = useBillingTokens();
  const progress = tokenRingProgress(snapshot);
  // viewBox 40: Stroke liegt innen, kein Clipping am Rand
  const vb = 40;
  const stroke = 3;
  const radius = (vb - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const label =
    snapshot == null
      ? "Token-Stand wird geladen"
      : snapshot.unlimited
        ? "Unbegrenzte Tokens"
        : `${snapshot.remaining.toLocaleString("de-DE")} von ${snapshot.total.toLocaleString("de-DE")} Tokens übrig`;

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-visible", className)}
      style={{ width: size, height: size }}
      title={label}
      aria-label={label}
    >
      <svg
        className="pointer-events-none absolute inset-0 size-full! max-h-none! max-w-none! -rotate-90 overflow-visible transition-none!"
        viewBox={`0 0 ${vb} ${vb}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <circle
          cx={vb / 2}
          cy={vb / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted-foreground/25"
        />
        <circle
          cx={vb / 2}
          cy={vb / 2}
          r={radius}
          fill="none"
          stroke="var(--color-acc, #C7691E)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {/* Avatar etwas kleiner als der Ring, damit der Bogen freiliegt */}
      <span className="relative z-10 flex size-[78%] items-center justify-center overflow-hidden rounded-full bg-background">
        {children}
      </span>
    </span>
  );
}
