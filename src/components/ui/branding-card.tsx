"use client";

// 21st.dev: ravikatiyar162/color-palette (demo id 7806)
import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export type BrandingCardProps = {
  category: string;
  title: string;
  subtitle: string;
  displayElement: React.ReactNode;
  /** Optional — weglassen, wenn Farben separat (z. B. ColorPaletteCard) gezeigt werden. */
  colors?: string[];
  className?: string;
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
};

const swatchVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

export function BrandingCard({
  className,
  category,
  title,
  subtitle,
  displayElement,
  colors,
}: BrandingCardProps) {
  const hasColors = Boolean(colors?.length);

  return (
    <motion.div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm transition-shadow duration-300 hover:shadow-lg",
        className,
      )}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      aria-label={`${category}: ${title}`}
      role="group"
    >
      <div className={cn("flex flex-1 flex-col justify-between p-5 md:p-6", !hasColors && "min-h-[160px]")}>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {category}
        </p>
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h3>
            <p className="truncate text-base text-muted-foreground md:text-lg">{subtitle}</p>
          </div>
          <div className="shrink-0 text-4xl font-bold tracking-tighter md:text-5xl">{displayElement}</div>
        </div>
      </div>

      {hasColors ? (
        <div className="flex h-16 w-full md:h-20">
          {colors!.map((color, index) => (
            <motion.div
              key={`${color}-${index}`}
              className="h-full flex-1"
              style={{ backgroundColor: color }}
              variants={swatchVariants}
              aria-label={`Color swatch ${index + 1}: ${color}`}
            />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
