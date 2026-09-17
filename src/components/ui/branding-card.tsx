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
  colors: string[];
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
  return (
    <motion.div
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow duration-300 hover:shadow-lg",
        className,
      )}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      aria-label={`${category}: ${title}`}
      role="group"
    >
      <div className="p-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {category}
        </p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
            <p className="text-lg text-muted-foreground">{subtitle}</p>
          </div>
          <div className="shrink-0 text-5xl font-bold tracking-tighter">{displayElement}</div>
        </div>
      </div>

      <div className="flex h-24 w-full">
        {colors.map((color, index) => (
          <motion.div
            key={`${color}-${index}`}
            className="h-full flex-1"
            style={{ backgroundColor: color }}
            variants={swatchVariants}
            aria-label={`Color swatch ${index + 1}: ${color}`}
          />
        ))}
      </div>
    </motion.div>
  );
}
