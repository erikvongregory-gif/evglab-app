"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type StudioTokenCharge = {
  id: string;
  imageUrl: string;
  title: string;
  createdAt: string;
  tokens: number;
};

type Props = {
  unlimited?: boolean;
  remaining?: number;
  monthly?: number;
  plan?: string | null;
  periodEnd?: string | null;
  recentCharges?: StudioTokenCharge[];
};

function formatTokens(n: number) {
  return n.toLocaleString("de-DE");
}

function formatPeriodEnd(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

function planLabel(plan: string | null | undefined) {
  if (!plan) return "Kein Abo";
  if (plan === "start") return "Start";
  if (plan === "growth") return "Growth";
  if (plan === "pro") return "Pro";
  return plan;
}

async function buyTokens(pack: "tokens_500" | "tokens_2000") {
  const res = await fetch("/api/billing/buy-tokens", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack }),
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error || "Nachkauf fehlgeschlagen.");
  }
  window.location.href = json.url;
}

export function StudioTokenBadge({
  unlimited = false,
  remaining,
  monthly,
  plan,
  periodEnd,
  recentCharges = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState<"tokens_500" | "tokens_2000" | null>(null);
  const [buyError, setBuyError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const known =
    !unlimited && typeof remaining === "number" && typeof monthly === "number" && monthly > 0;
  const ratio = known ? remaining / monthly : 1;
  const tone = !known ? "ok" : ratio <= 0.05 ? "err" : ratio <= 0.2 ? "warn" : "ok";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const onBuy = useCallback(async (pack: "tokens_500" | "tokens_2000") => {
    setBuyError("");
    setBuying(pack);
    try {
      await buyTokens(pack);
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Nachkauf fehlgeschlagen.");
      setBuying(null);
    }
  }, []);

  if (unlimited) {
    return (
      <div ref={rootRef} style={{ position: "relative" }} data-tour="tokens">
        <button
          type="button"
          className="evg-tokens"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="evg-tokens__val">Unbegrenzt</span>
        </button>
        {open ? (
          <div
            id={panelId}
            className="evg-pop"
            role="dialog"
            aria-label="Token-Status"
            style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 240, padding: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
              <span style={{ color: "var(--fg-5)" }}>Plan</span>
              <span className="evg-mono">Owner</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--fg-5)" }}>
              Dein Konto hat kein Token-Limit. Abbuchungen erscheinen nicht.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (!known) return null;

  const resetLabel = formatPeriodEnd(periodEnd);

  return (
    <div ref={rootRef} style={{ position: "relative" }} data-tour="tokens">
      <button
        type="button"
        className={cn(
          "evg-tokens",
          tone === "warn" && "evg-tokens--warn",
          tone === "err" && "evg-tokens--err",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="evg-tokens__val">{formatTokens(remaining)}</span>
        <span className="evg-tokens__bar" aria-hidden="true">
          <span className="evg-tokens__fill" style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%`, display: "block" }} />
        </span>
        <span className="evg-tokens__max">{formatTokens(monthly)}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="evg-pop"
          role="dialog"
          aria-label="Token-Details"
          style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 280, padding: 12 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
            <span style={{ color: "var(--fg-5)" }}>Plan</span>
            <span>{planLabel(plan)}</span>
          </div>
          {resetLabel ? (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, marginTop: 8 }}>
              <span style={{ color: "var(--fg-5)" }}>Reset</span>
              <span className="evg-mono">{resetLabel}</span>
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <div className="evg-rubrik">Letzte Abbuchungen</div>
            {recentCharges.length === 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--fg-5)" }}>Noch keine Abbuchungen</p>
            ) : (
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {recentCharges.map((c) => (
                  <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={c.imageUrl} alt="" width={28} height={28} style={{ objectFit: "cover", border: "1px solid var(--line)" }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                    </span>
                    <span className="evg-mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>
                      ÔêÆ{formatTokens(c.tokens)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--fg-5)" }}>
            Nachgekaufte Tokens bleiben bei der Verl├ñngerung erhalten.
          </p>

          {buyError ? (
            <p className="evg-note" style={{ marginTop: 10, fontSize: 12.5, color: "var(--err)", padding: 8 }}>
              {buyError}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="evg-btn" disabled={buying !== null} onClick={() => void onBuy("tokens_500")}>
              {buying === "tokens_500" ? "ÔÇª" : "+500 Tokens"}
            </button>
            <button type="button" className="evg-btn" disabled={buying !== null} onClick={() => void onBuy("tokens_2000")}>
              {buying === "tokens_2000" ? "ÔÇª" : "+2.000 Tokens"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
