"use client";

// 21st.dev: vinny_b0b96136/arch-gallery (demo id 24413)
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type ArchGalleryItem = {
  image: { src: string; alt?: string };
};

export type ArchGalleryProps = {
  items: ArchGalleryItem[];
  cardWidth?: number;
  cardHeight?: number;
  cornerRadius?: number;
  className?: string;
  /** Accessible label for the gallery group. */
  label?: string;
};

const ROTATE_STEP = 6;
const Y_STEP = 18;
const OVERLAP = 0.58;
const HOVER_SCALE = 1.08;
const HOVER_LIFT = 16;

export function ArchGallery({
  items,
  cardWidth = 160,
  cardHeight = 200,
  cornerRadius = 14,
  className,
  label = "Referenzbilder",
}: ArchGalleryProps) {
  const deck = items;
  const total = deck.length;
  const mid = (total - 1) / 2;
  const [hovered, setHovered] = useState<number | null>(null);

  if (total === 0) return null;

  const stageWidth = cardWidth + Math.abs(mid) * 2 * cardWidth * OVERLAP + cardWidth * 0.2;
  const stageHeight = cardHeight + Math.abs(mid) * Y_STEP + 48;

  return (
    <div
      className={cn("flex w-full items-center justify-center overflow-x-auto py-4", className)}
      role="group"
      aria-label={label}
    >
      <div className="relative shrink-0" style={{ width: stageWidth, height: stageHeight }}>
        {deck.map((entry, index) => {
          const offset = index - mid;
          const rotate = offset * ROTATE_STEP;
          const translateY = Math.abs(offset) * Y_STEP;
          const translateX = offset * cardWidth * OVERLAP;
          const baseZ = total - Math.abs(offset);
          const isHovered = hovered === index;

          const cardStyle: CSSProperties = {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: cardWidth,
            height: cardHeight,
            marginLeft: -cardWidth / 2,
            marginTop: -cardHeight / 2,
            borderRadius: cornerRadius,
            overflow: "hidden",
            transformOrigin: "center center",
            transform: isHovered
              ? `translate(${translateX}px, ${translateY - HOVER_LIFT}px) rotate(0deg) scale(${HOVER_SCALE})`
              : `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) scale(1)`,
            zIndex: isHovered ? total + 1 : baseZ,
            transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
            cursor: "pointer",
            backgroundColor: "var(--muted, #f3f4f6)",
          };

          return (
            <div
              key={`${entry.image.src}-${index}`}
              style={cardStyle}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              aria-label={entry.image.alt || `Foto ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.image.src}
                alt={entry.image.alt || ""}
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
