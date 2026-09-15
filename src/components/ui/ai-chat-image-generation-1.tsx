"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface ImageGenerationProps {
  isLoading: boolean;
  /** Bild-URL — sobald gesetzt, startet der langsame Blur-Reveal. */
  imageSrc?: string | null;
  progress?: number;
  className?: string;
  aspectRatio?: string;
  hideStatus?: boolean;
  alt?: string;
  onPreviewClick?: (src: string) => void;
}

const STATUS = {
  starting: "Wird gestartet …",
  generating: "BrewAI generiert dein Bild …",
  revealing: "Bild wird sichtbar …",
  completed: "Bild erstellt.",
} as const;

export const ImageGeneration = ({
  isLoading,
  imageSrc,
  progress,
  className,
  aspectRatio = "4:5",
  hideStatus = false,
  alt = "Motivvorschau",
  onPreviewClick,
}: ImageGenerationProps) => {
  const clampedProgress = Math.max(0, Math.min(100, progress ?? 0));
  const [decoded, setDecoded] = React.useState(false);
  const [sharp, setSharp] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const revealStarted = React.useRef(false);

  const beginReveal = React.useCallback(() => {
    if (revealStarted.current) return;
    revealStarted.current = true;
    setDecoded(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSharp(true));
    });
  }, []);

  React.useEffect(() => {
    setDecoded(false);
    setSharp(false);
    revealStarted.current = false;
  }, [imageSrc]);

  React.useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) beginReveal();
  }, [imageSrc, beginReveal]);

  const loadingState: keyof typeof STATUS = !isLoading && sharp
    ? "completed"
    : imageSrc && decoded && !sharp
      ? "revealing"
      : clampedProgress < 10
        ? "starting"
        : "generating";

  const showAurora = isLoading || (Boolean(imageSrc) && !sharp);
  const showImage = Boolean(imageSrc);

  const handleImageLoad = () => {
    beginReveal();
  };

  return (
    <div className={cn("studio-image-gen flex flex-col gap-2", className)}>
      {hideStatus ? null : (
        <motion.span
          className="studio-image-gen__status bg-[length:200%_100%] bg-clip-text text-transparent text-base font-medium"
          style={{
            backgroundImage:
              "linear-gradient(110deg, var(--t3, #5E574E), 35%, var(--ac, #C7691E), 50%, var(--t1, #18140F), 65%, var(--t3, #5E574E), 85%, var(--t3, #5E574E))",
          }}
          initial={{ backgroundPosition: "200% 0" }}
          animate={{
            backgroundPosition: loadingState === "completed" ? "0% 0" : "-200% 0",
          }}
          transition={{
            repeat: loadingState === "completed" ? 0 : Infinity,
            duration: 3,
            ease: "linear",
          }}
          aria-live="polite"
        >
          {STATUS[loadingState]}
        </motion.span>
      )}

      <div
        className={cn(
          "studio-image-gen__frame studio-create-preview-stage relative overflow-hidden",
          isLoading && !imageSrc ? "is-generating" : "",
        )}
        data-aspect={aspectRatio}
      >
        {showAurora ? (
          <div className="studio-image-gen__aurora" aria-hidden="true">
            <div className="studio-image-gen__aurora-spin" />
          </div>
        ) : null}

        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={imageSrc ?? "empty"}
            ref={imgRef}
            src={imageSrc ?? undefined}
            alt={alt}
            className={cn(
              "studio-create-preview-stage__img studio-image-gen__img",
              !sharp && "is-blurred",
              sharp && "is-sharp",
            )}
            onLoad={handleImageLoad}
            onClick={() => {
              if (imageSrc && onPreviewClick) onPreviewClick(imageSrc);
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

ImageGeneration.displayName = "ImageGeneration";

export default ImageGeneration;
