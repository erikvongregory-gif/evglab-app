"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type SVGProps } from "react";
import { cn } from "@/lib/utils";

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function HugoBase({
  S,
  body,
  face,
}: {
  S: number;
  body: string;
  face: string;
}) {
  const cx = S / 2;
  const cy = S / 2;
  const bodyW = S * 0.3;
  const bodyH = S * 0.4;
  const bodyCY = cy + S * 0.06;

  const leafBaseX = cx;
  const leafBaseY = bodyCY - bodyH + S * 0.01;
  const leafW = S * 0.16;
  const leafH = S * 0.09;
  const stemY1 = bodyCY - bodyH - S * 0.04;
  const stemY2 = bodyCY - bodyH + S * 0.01;
  const swThin = S * 0.028;

  const scaleRows = [
    { y: bodyCY - bodyH * 0.42, w: bodyW * 0.55, count: 2 },
    { y: bodyCY - bodyH * 0.14, w: bodyW * 0.8, count: 3 },
    { y: bodyCY + bodyH * 0.16, w: bodyW * 0.7, count: 3 },
  ];

  function scaleArc(scx: number, scy: number, w: number, h: number) {
    return `M ${scx - w / 2} ${scy} Q ${scx} ${scy - h} ${scx + w / 2} ${scy}`;
  }

  return (
    <>
      <path
        d={`M ${leafBaseX} ${leafBaseY}
            C ${leafBaseX - leafW * 0.3} ${leafBaseY - leafH * 1.1}
              ${leafBaseX - leafW * 0.9} ${leafBaseY - leafH * 0.4}
              ${leafBaseX - leafW} ${leafBaseY + leafH * 0.1}
            C ${leafBaseX - leafW * 0.5} ${leafBaseY + leafH * 0.3}
              ${leafBaseX - S * 0.01} ${leafBaseY + leafH * 0.1}
              ${leafBaseX} ${leafBaseY} Z`}
        fill={body}
        opacity={0.55}
      />
      <path
        d={`M ${leafBaseX} ${leafBaseY}
            C ${leafBaseX + leafW * 0.3} ${leafBaseY - leafH * 1.1}
              ${leafBaseX + leafW * 0.9} ${leafBaseY - leafH * 0.4}
              ${leafBaseX + leafW} ${leafBaseY + leafH * 0.1}
            C ${leafBaseX + leafW * 0.5} ${leafBaseY + leafH * 0.3}
              ${leafBaseX + S * 0.01} ${leafBaseY + leafH * 0.1}
              ${leafBaseX} ${leafBaseY} Z`}
        fill={body}
        opacity={0.55}
      />
      <line
        x1={cx}
        y1={stemY1}
        x2={cx}
        y2={stemY2}
        stroke={body}
        strokeWidth={swThin}
        strokeLinecap="round"
      />
      <ellipse cx={cx} cy={bodyCY} rx={bodyW} ry={bodyH} fill={body} />
      {scaleRows.map((row, ri) => {
        const spacing = (row.w * 2) / row.count;
        const startX = cx - row.w + spacing * 0.5;
        return Array.from({ length: row.count }).map((_, i) => {
          const scx = startX + i * spacing;
          const scW = spacing * 0.78;
          const scH = S * 0.038;
          return (
            <path
              key={`sc-${ri}-${i}`}
              d={scaleArc(scx, row.y, scW, scH)}
              stroke={face}
              strokeWidth={swThin * 0.55}
              fill="none"
              strokeLinecap="round"
              opacity={0.35}
            />
          );
        });
      })}
    </>
  );
}

function ThinkingEyes({ S, face, speed = 1 }: { S: number; face: string; speed?: number }) {
  const cx = S / 2;
  const cy = S / 2;
  const bodyH = S * 0.4;
  const bodyCY = cy + S * 0.06;
  const faceY = bodyCY + bodyH * 0.05;
  const eyeY = faceY - S * 0.055;
  const eyeSpacing = S * 0.088;
  const eyeR = S * 0.034;
  const pupilR = S * 0.014;
  const orbitR = eyeR * 0.55;

  const [angle, setAngle] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (ts: number) => {
      if (lastRef.current !== null) {
        const delta = ts - lastRef.current;
        setAngle((a) => a + delta * 0.0018 * speed);
      }
      lastRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [speed]);

  const leftPupilX = cx - eyeSpacing + orbitR * Math.cos(angle);
  const leftPupilY = eyeY + orbitR * Math.sin(angle) * 0.7;

  const rightPupilX = cx + eyeSpacing + orbitR * Math.cos(angle + Math.PI * 0.6);
  const rightPupilY = eyeY + orbitR * Math.sin(angle + Math.PI * 0.6) * 0.7;

  const mouthY = faceY + S * 0.062;
  const mouthW = S * 0.088;
  const swThin = S * 0.028;

  return (
    <>
      <circle cx={cx - eyeSpacing} cy={eyeY} r={eyeR} fill={face} opacity={0.12} />
      <circle cx={cx + eyeSpacing} cy={eyeY} r={eyeR} fill={face} opacity={0.12} />

      <circle cx={leftPupilX} cy={leftPupilY} r={pupilR} fill={face} />
      <circle cx={rightPupilX} cy={rightPupilY} r={pupilR} fill={face} />

      <path
        d={`M ${cx - mouthW * 0.38} ${mouthY}
            Q ${cx} ${mouthY + S * 0.028}
              ${cx + mouthW * 0.38} ${mouthY}`}
        stroke={face}
        strokeWidth={swThin * 0.9}
        fill="none"
        strokeLinecap="round"
        opacity={0.9}
      />
    </>
  );
}

function SmirkFace({ S, face }: { S: number; face: string }) {
  const cx = S / 2;
  const cy = S / 2;
  const bodyH = S * 0.4;
  const bodyCY = cy + S * 0.06;
  const faceY = bodyCY + bodyH * 0.05;
  const eyeY = faceY - S * 0.055;
  const eyeSpacing = S * 0.088;
  const eyeR = S * 0.028;
  const mouthY = faceY + S * 0.062;
  const mouthW = S * 0.088;
  const swThin = S * 0.028;

  return (
    <>
      <circle cx={cx - eyeSpacing} cy={eyeY} r={eyeR} fill={face} />
      <circle cx={cx + eyeSpacing} cy={eyeY} r={eyeR} fill={face} />
      <path
        d={`M ${cx + eyeSpacing - eyeR * 1.4} ${eyeY - eyeR * 2.0}
            Q ${cx + eyeSpacing} ${eyeY - eyeR * 3.3}
              ${cx + eyeSpacing + eyeR * 1.4} ${eyeY - eyeR * 2.0}`}
        stroke={face}
        strokeWidth={swThin * 0.9}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - mouthW * 0.5} ${mouthY + S * 0.008}
            C ${cx - mouthW * 0.1} ${mouthY + S * 0.012}
              ${cx + mouthW * 0.2} ${mouthY - S * 0.006}
              ${cx + mouthW * 0.5} ${mouthY - S * 0.018}`}
        stroke={face}
        strokeWidth={swThin * 1.1}
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

export type HopfenHugoAvatarProps = {
  /** Kantenlänge des SVG (px). */
  size: number;
  /** „Denkt nach" — Pupillen kreisen (raf); bei `prefers-reduced-motion` nur Statik. */
  thinking?: boolean;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox">;

/**
 * Vektor-Hopfen Hugo (Prototyp „evglab-hopfenhugo-animated"): ruhend oder „thinking"-Animation.
 */
export function HopfenHugoAvatar({ size, thinking = false, className, ...svgProps }: HopfenHugoAvatarProps) {
  const reduced = usePrefersReducedMotion();
  const baseId = useId().replace(/:/g, "");
  const clipId = `hugo-clip-${baseId}`;
  const S = size;
  const cx = S / 2;
  const cy = S / 2;
  const bg = "#111110";
  const body = "#D4A24C";
  const face = "#111110";
  const avatarR = S * 0.5 - 1;

  const showThinking = thinking && !reduced;

  return (
    <svg
      width={S}
      height={S}
      viewBox={`0 0 ${S} ${S}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden
      {...svgProps}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={avatarR} />
        </clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={avatarR} fill={bg} />

      <g clipPath={`url(#${clipId})`}>
        <HugoBase S={S} body={body} face={face} />
        {showThinking ? (
          <ThinkingEyes S={S} face={face} speed={1} />
        ) : (
          <SmirkFace S={S} face={face} />
        )}
      </g>
    </svg>
  );
}
