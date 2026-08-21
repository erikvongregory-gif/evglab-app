"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { StudioButton } from "@/components/studio/ui";
import { studioFontClassName } from "@/lib/fonts/studio-fonts";

/* Studio-Tokens explizit — Tour rendert per Portal außerhalb der Shell */
const T = {
  bg0: "#131211",
  bg1: "#1a1816",
  bg2: "#201d1b",
  bg3: "#272320",
  bg4: "#312c28",
  line: "rgba(255, 255, 255, 0.07)",
  lineStrong: "rgba(255, 255, 255, 0.12)",
  tx0: "#f4f1ec",
  tx1: "#c4bdb3",
  tx2: "#8a837a",
  tx3: "#635c54",
  acc: "#e8772e",
  accHi: "#f08a45",
  accLo: "#b85f24",
  accInk: "#2a1408",
  rMd: "14px",
  rLg: "18px",
  rPill: "999px",
  shPop: "0 24px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255, 255, 255, 0.12)",
} as const;

/* ---- Farb-Tokens für die Mini-UI im Video ---- */
const V = {
  bg0: "#131211",
  bg1: "#1a1816",
  bg2: "#201d1b",
  bg3: "#272320",
  acc: "#e8772e",
  ok: "#6fae84",
  tx0: "#f4f1ec",
  tx1: "#c4bdb3",
  tx2: "#8a837a",
  ln: "rgba(255,255,255,0.07)",
};

type TourPlacement = "right" | "bottom" | "bottom-left";

type TourStep = {
  sel: string | null;
  title: string;
  body: string;
  primary?: string;
  placement?: TourPlacement;
  isWelcome?: boolean;
  isDone?: boolean;
};

const TOUR: TourStep[] = [
  {
    sel: null,
    title: "Willkommen bei BrewAI Studio",
    body: "Lass uns kurz zeigen, was möglich ist — dauert unter einer Minute.",
    primary: "Tour starten",
    isWelcome: true,
  },
  {
    sel: '[data-tour="nav"]',
    title: "Deine Arbeitsbereiche",
    body: "Dashboard, Mediathek, Team und Einstellungen — alles einen Klick entfernt.",
    placement: "right",
  },
  {
    sel: '[data-tour="create"]',
    title: "Motiv in Sekunden",
    body: "Dein wichtigster Knopf: Stil wählen, Prompt eingeben — Bild fertig.",
    placement: "bottom-left",
  },
  {
    sel: '[data-tour="search"]',
    title: "Schnellsuche",
    body: "Finde Motive und Kampagnen blitzschnell — oder drück ⌘K von überall.",
    placement: "bottom",
  },
  {
    sel: '[data-tour="tokens"]',
    title: "Token-Anzeige",
    body: "Tokens sind dein KI-Budget. Hier siehst du jederzeit, wie viel übrig ist.",
    placement: "bottom-left",
  },
  {
    sel: null,
    title: "Alles klar — los geht's!",
    body: "Du kennst die wichtigsten Stellen. Starte jetzt mit deinem ersten Motiv.",
    primary: "Erstes Motiv erstellen",
    isDone: true,
  },
];

type SpotRect = { x: number; y: number; w: number; h: number };

function useSpotRect(sel: string | null): SpotRect | null {
  const [rect, setRect] = useState<SpotRect | null>(null);

  useLayoutEffect(() => {
    if (!sel) {
      setRect(null);
      return;
    }
    const go = () => {
      const el = document.querySelector(sel);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    go();
    window.addEventListener("resize", go);
    return () => window.removeEventListener("resize", go);
  }, [sel]);

  return rect;
}

function VP({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: active ? 1 : 0,
        transition: "opacity .55s ease",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function MiniDash({ glow }: { glow: boolean }) {
  return (
    <div style={{ display: "flex", height: "100%", fontSize: 10 }}>
      <div
        style={{
          width: 84,
          background: V.bg1,
          borderRight: `1px solid ${V.ln}`,
          padding: "10px 7px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <div style={{ width: 15, height: 15, borderRadius: 4, background: V.acc, flexShrink: 0 }} />
          <span className="studio-accent-serif" style={{ color: V.tx0, fontSize: 11, fontWeight: 500 }}>
            BrewAI
          </span>
        </div>
        {["Dashboard", "Erstellen", "Mediathek", "Team"].map((n, i) => (
          <div
            key={n}
            style={{
              padding: "5px 7px",
              borderRadius: 5,
              marginBottom: 2,
              fontSize: 9,
              color: i === 0 ? V.acc : V.tx2,
              background: i === 0 ? "rgba(232,119,46,.12)" : "transparent",
            }}
          >
            {n}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: "9px 11px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 15, background: V.bg2, borderRadius: 4 }} />
          <div
            style={{
              height: 21,
              padding: "0 9px",
              borderRadius: 5,
              fontSize: 9,
              fontWeight: 700,
              background: V.acc,
              color: "#1a0a00",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              animation: glow ? "studio-tour-pulsebtn 1.1s ease-in-out infinite" : "none",
            }}
          >
            + Neu erstellen
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
          {[
            ["Generierungen", "847"],
            ["Reichweite", "23.4k"],
          ].map(([l, val]) => (
            <div
              key={l}
              style={{ background: V.bg2, border: `1px solid ${V.ln}`, borderRadius: 5, padding: "7px 8px" }}
            >
              <div style={{ color: V.tx2, fontSize: 8, marginBottom: 4 }}>{l}</div>
              <div className="studio-accent-serif" style={{ color: V.tx0, fontSize: 17, lineHeight: 1 }}>
                {val}
              </div>
            </div>
          ))}
        </div>
        {[30, 60].map((hue, i) => (
          <div
            key={hue}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              padding: "5px 0",
              borderBottom: `1px solid ${V.ln}`,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 4,
                flexShrink: 0,
                background: `oklch(0.38 0.07 ${hue})`,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 5,
                  width: `${65 + i * 20}px`,
                  background: V.bg3,
                  borderRadius: 3,
                  marginBottom: 3,
                }}
              />
              <div style={{ height: 4, width: "38px", background: V.bg3, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PROMPT = "Produktfoto mit Hopfen und warmem Licht";

function MiniCreate({ chars }: { chars: number }) {
  const shown = PROMPT.slice(0, chars);
  const done = chars >= PROMPT.length;
  return (
    <div style={{ padding: "13px 15px", height: "100%" }}>
      <div
        className="studio-mono"
        style={{
          color: V.tx2,
          fontSize: 8,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 7,
        }}
      >
        Neues Motiv erstellen
      </div>
      <div className="studio-accent-serif" style={{ color: V.tx0, fontSize: 16, marginBottom: 11 }}>
        Was soll generiert werden?
      </div>
      <div style={{ display: "flex", gap: 5, marginBottom: 11 }}>
        {["Produktfoto", "Kampagne", "Social"].map((c, i) => (
          <div
            key={c}
            style={{
              padding: "3px 9px",
              borderRadius: 99,
              fontSize: 8,
              fontWeight: 600,
              background: i === 0 ? "rgba(232,119,46,.15)" : V.bg2,
              border: `1px solid ${i === 0 ? "rgba(232,119,46,.4)" : V.ln}`,
              color: i === 0 ? V.acc : V.tx2,
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div
        style={{
          background: V.bg1,
          border: "1px solid rgba(232,119,46,.35)",
          borderRadius: 7,
          padding: "9px 11px",
          marginBottom: 11,
          minHeight: 48,
        }}
      >
        <span style={{ color: V.tx0, fontSize: 11, lineHeight: 1.5 }}>{shown}</span>
        {!done ? (
          <span style={{ color: V.tx1, animation: "studio-tour-blink 1s step-end infinite" }}>|</span>
        ) : null}
      </div>
      <div
        style={{
          height: 27,
          background: done ? V.acc : V.bg2,
          border: `1px solid ${done ? "transparent" : V.ln}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: done ? "#1a0a00" : V.tx2,
          transition: "all .5s",
        }}
      >
        {done ? "✦  Motiv generieren" : "Stil & Prompt wählen…"}
      </div>
    </div>
  );
}

function MiniGen({ pct }: { pct: number }) {
  const steps = ["Motiv komponieren", "Farben abstimmen", "Stil verfeinern", "Letzter Schliff"];
  const si = Math.min(Math.floor((pct / 100) * steps.length), steps.length - 1);
  return (
    <div
      style={{
        padding: "0 22px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="36"
        height="24"
        viewBox="0 0 40 26"
        fill="none"
        stroke={V.acc}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ marginBottom: 11, animation: "studio-tour-wavebob .95s ease-in-out infinite" }}
        aria-hidden="true"
      >
        <path d="M3 8c4-2.5 7 2.5 11 0s7-2.5 11 0 7 2.5 11 0" />
        <path d="M3 16c4-2.5 7 2.5 11 0s7-2.5 11 0 7 2.5 11 0" />
      </svg>
      <div style={{ color: V.tx0, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Generieren läuft…</div>
      <div className="studio-mono" style={{ color: V.tx2, fontSize: 9, marginBottom: 13 }}>
        {steps[si]}
      </div>
      <div
        style={{
          width: "100%",
          height: 3,
          background: V.bg3,
          borderRadius: 99,
          overflow: "hidden",
          marginBottom: 7,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg,${V.acc},#f0a060)`,
            borderRadius: 99,
            transition: "width .28s linear",
          }}
        />
      </div>
      <div className="studio-mono" style={{ color: V.tx2, fontSize: 9 }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

function MiniResult() {
  return (
    <div style={{ padding: "10px 12px", height: "100%", display: "flex", gap: 10, alignItems: "center" }}>
      <div
        style={{
          width: 112,
          height: "calc(100% - 12px)",
          borderRadius: 7,
          flexShrink: 0,
          overflow: "hidden",
          background:
            "linear-gradient(148deg, oklch(.43 .11 35) 0%, oklch(.28 .08 43) 60%, oklch(.19 .04 30) 100%)",
          border: `1px solid ${V.ln}`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0 2px,transparent 2px 9px)",
          }}
        />
        <div
          className="studio-mono"
          style={{
            position: "absolute",
            top: 7,
            left: 7,
            background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(4px)",
            borderRadius: 3,
            padding: "2px 5px",
            fontSize: 7,
            color: "rgba(255,255,255,.7)",
            letterSpacing: ".09em",
          }}
        >
          GENERIERT
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(111,174,132,.15)",
            border: "1px solid rgba(111,174,132,.3)",
            borderRadius: 99,
            padding: "2px 7px",
            marginBottom: 8,
          }}
        >
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: V.ok }} />
          <span className="studio-mono" style={{ fontSize: 8, color: V.ok, letterSpacing: ".09em" }}>
            FERTIG
          </span>
        </div>
        <div style={{ color: V.tx0, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Produktfoto mit Hopfen</div>
        <div className="studio-faint" style={{ fontSize: 9, marginBottom: 12 }}>
          Produktfoto · gerade eben
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div
            style={{
              height: 24,
              background: V.acc,
              borderRadius: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 700,
              color: "#1a0a00",
            }}
          >
            ⬇  Exportieren
          </div>
          <div
            style={{
              height: 24,
              background: V.bg2,
              border: `1px solid ${V.ln}`,
              borderRadius: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              color: V.tx1,
            }}
          >
            Mediathek
          </div>
        </div>
      </div>
    </div>
  );
}

const VID_TOTAL = 14;
/** Handoff-Screenshot: Generierungs-Phase (~52 %) statt Mini-Dashboard beim Start */
const TOUR_VIDEO_START = 9.2;

function TourVideo({ initialTime = TOUR_VIDEO_START }: { initialTime?: number }) {
  const [t, setT] = useState(initialTime);
  const [play, setPlay] = useState(true);

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setT((p) => (p >= VID_TOTAL ? 0 : +(p + 0.05).toFixed(3))), 50);
    return () => clearInterval(id);
  }, [play]);

  const ph = t < 2.5 ? 0 : t < 4.5 ? 1 : t < 8.5 ? 2 : t < 11.5 ? 3 : 4;
  const phRanges: [number, number][] = [
    [0, 2.5],
    [2.5, 4.5],
    [4.5, 8.5],
    [8.5, 11.5],
    [11.5, VID_TOTAL],
  ];
  const [ps, pe] = phRanges[ph];
  const pct = Math.min(1, Math.max(0, (t - ps) / (pe - ps)));

  const chars = ph === 2 ? Math.floor(pct * PROMPT.length) : ph > 2 ? PROMPT.length : 0;
  const genPct = ph === 3 ? pct * 100 : ph > 3 ? 100 : 0;
  const bar = (t / VID_TOTAL) * 100;
  const ts = `0:${Math.floor(t).toString().padStart(2, "0")}`;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setT(Math.max(0, Math.min(VID_TOTAL, ((e.clientX - r.left) / r.width) * VID_TOTAL)));
  };

  return (
    <div style={{ borderRadius: T.rMd, overflow: "hidden", background: V.bg0, border: `1px solid ${V.ln}` }}>
      <div style={{ position: "relative", height: 220, background: V.bg0 }}>
        <VP active={ph === 0}>
          <MiniDash glow={false} />
        </VP>
        <VP active={ph === 1}>
          <MiniDash glow />
        </VP>
        <VP active={ph === 2}>
          <MiniCreate chars={chars} />
        </VP>
        <VP active={ph === 3}>
          <MiniGen pct={genPct} />
        </VP>
        <VP active={ph === 4}>
          <MiniResult />
        </VP>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 12px",
          background: V.bg1,
          borderTop: `1px solid ${V.ln}`,
        }}
      >
        <button
          type="button"
          onClick={() => setPlay((p) => !p)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 5,
            border: 0,
            background: V.bg3,
            color: V.tx1,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
          aria-label={play ? "Pause" : "Abspielen"}
        >
          {play ? (
            <svg width="9" height="9" viewBox="0 0 24 24" fill={V.tx1} aria-hidden="true">
              <rect x="5" y="3" width="5" height="18" rx="1" />
              <rect x="14" y="3" width="5" height="18" rx="1" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 24 24" fill={V.tx1} aria-hidden="true">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
          )}
        </button>
        <div
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={VID_TOTAL}
          aria-valuenow={t}
          onClick={seek}
          onKeyDown={() => {}}
          style={{
            flex: 1,
            height: 3,
            background: V.bg3,
            borderRadius: 99,
            cursor: "pointer",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${bar}%`,
              height: "100%",
              background: `linear-gradient(90deg,${V.acc},#f0a060)`,
              borderRadius: 99,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${bar}%`,
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: V.tx0,
              boxShadow: `0 0 0 2px ${V.acc}`,
              pointerEvents: "none",
            }}
          />
        </div>
        <span className="studio-mono studio-faint" style={{ fontSize: 9, flexShrink: 0 }}>
          {ts} / 0:14
        </span>
      </div>
    </div>
  );
}

function ChevronForward() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronBack() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function StudioOnboardingTour({
  onDone,
  onGoCreate,
}: {
  onDone: () => void;
  onGoCreate?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const s = TOUR[idx];
  const isFirst = idx === 0;
  const isLast = idx === TOUR.length - 1;
  const isEdge = isFirst || isLast;
  const rect = useSpotRect(s.sel);

  const INNER = TOUR.filter((t) => t.sel).length;
  const innerDone = TOUR.slice(0, idx + 1).filter((t) => t.sel).length;

  const finish = () => {
    onDone();
    if (s.isDone && onGoCreate) onGoCreate();
  };

  const next = () => (isLast ? finish() : setIdx((i) => i + 1));
  const back = () => idx > 0 && setIdx((i) => i - 1);

  const PAD = 10;
  const TW = 310;
  const GAP = 18;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const spot: CSSProperties | null = rect
    ? {
        position: "fixed",
        zIndex: 1001,
        pointerEvents: "none",
        left: rect.x - PAD,
        top: rect.y - PAD,
        width: rect.w + PAD * 2,
        height: rect.h + PAD * 2,
        borderRadius: 14,
        boxShadow: `0 0 0 9999px rgba(10,8,7,0.80), 0 0 0 1.5px ${T.accLo}`,
        transition: ["left", "top", "width", "height"]
          .map((p) => `${p} .38s cubic-bezier(.2,.7,.2,1)`)
          .join(","),
      }
    : null;

  const cardW = isFirst ? 560 : isLast ? 420 : TW;
  let tp: CSSProperties = { position: "fixed", width: cardW, zIndex: 1002 };

  if (!rect || !s.placement) {
    tp = { ...tp, left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
  } else if (s.placement === "right") {
    tp.left = rect.x + rect.w + PAD + GAP;
    tp.top = Math.max(16, rect.y + rect.h / 2 - 110);
  } else if (s.placement === "bottom") {
    const cx = rect.x + rect.w / 2;
    tp.left = Math.max(16, Math.min(cx - TW / 2, window.innerWidth - TW - 16));
    tp.top = rect.y + rect.h + PAD + GAP;
  } else if (s.placement === "bottom-left") {
    tp.left = Math.max(16, rect.x + rect.w - TW);
    tp.top = rect.y + rect.h + PAD + GAP;
  }

  if (!mounted) return null;

  const overlay = (
    <div
      className={`evg-studio ${studioFontClassName}`}
      style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          pointerEvents: "auto",
          background: isEdge ? "rgba(10,8,7,0.88)" : "transparent",
          backdropFilter: isEdge ? "blur(6px)" : "none",
          WebkitBackdropFilter: isEdge ? "blur(6px)" : "none",
          transition: "background .4s, backdrop-filter .4s",
        }}
        aria-hidden="true"
      />

      {spot ? <div style={{ ...spot, pointerEvents: "none" }} aria-hidden="true" /> : null}

      <div className="studio-tour-card-mobile" style={{ ...tp, pointerEvents: "auto" }} key={idx}>
        <div
          className="studio-tour-sheet-in"
          style={{
            background: T.bg2,
            border: `1px solid ${T.lineStrong}`,
            borderRadius: T.rLg,
            boxShadow: T.shPop,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 3,
              background: `linear-gradient(90deg, ${T.accLo}, ${T.accHi}, ${T.accLo})`,
            }}
          />

          <div style={{ padding: isFirst ? "16px 18px 18px" : "20px 22px 18px" }}>
            {isFirst ? (
              <div style={{ marginBottom: 16 }}>
                <TourVideo initialTime={TOUR_VIDEO_START} />
              </div>
            ) : null}

            {isLast ? (
              <div style={{ marginBottom: 14, color: T.acc }}>
                <svg
                  width="30"
                  height="20"
                  viewBox="0 0 34 22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 7c4-2.4 6 2.4 9 0s5.5-2.4 9 0 5.5 2.4 9 0" />
                  <path d="M2 13c4-2.4 6 2.4 9 0s5.5-2.4 9 0 5.5 2.4 9 0" />
                  <path d="M2 19c4-2.4 6 2.4 9 0s5.5-2.4 9 0 5.5 2.4 9 0" />
                </svg>
              </div>
            ) : null}

            {!isEdge ? (
              <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
                {Array.from({ length: INNER }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 2.5,
                      borderRadius: 99,
                      background: i < innerDone ? T.acc : T.bg4,
                      transition: "background .35s",
                    }}
                  />
                ))}
              </div>
            ) : null}

            <h3
              className="studio-accent-serif"
              style={{
                fontSize: isEdge ? 26 : 20,
                fontWeight: 500,
                letterSpacing: "-0.012em",
                lineHeight: 1.15,
                color: T.tx0,
                marginBottom: 10,
                marginTop: 0,
              }}
            >
              {s.title}
            </h3>
            <p className="studio-faint" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              {s.body}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: !isEdge ? "space-between" : "flex-end",
                marginTop: 20,
                gap: 10,
              }}
            >
              {!isEdge ? (
                <button
                  type="button"
                  onClick={back}
                  className="studio-faint"
                  style={{
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: 0,
                    transition: "color .14s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = T.tx0;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = T.tx2;
                  }}
                >
                  <ChevronBack />
                  Zurück
                </button>
              ) : null}
              <StudioButton
                variant="primary"
                onClick={s.isDone ? finish : next}
                style={{ gap: 7, display: "inline-flex", alignItems: "center" }}
              >
                {s.primary || "Weiter"}
                {!s.primary ? <ChevronForward /> : null}
              </StudioButton>
            </div>
          </div>
        </div>
      </div>

      {!isLast ? (
        <button
          type="button"
          onClick={onDone}
          className="studio-mono"
          style={{
            position: "fixed",
            bottom: 22,
            right: 22,
            zIndex: 1003,
            pointerEvents: "auto",
            background: T.bg2,
            border: `1px solid ${T.line}`,
            borderRadius: T.rPill,
            cursor: "pointer",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.tx2,
            padding: "8px 14px",
            transition: "color .15s, border-color .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = T.tx0;
            e.currentTarget.style.borderColor = T.lineStrong;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = T.tx2;
            e.currentTarget.style.borderColor = T.line;
          }}
        >
          Überspringen ×
        </button>
      ) : null}
    </div>
  );

  return createPortal(overlay, document.body);
}
