"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, MouseEvent } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface BeerIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface BeerIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

/** Rising foam / bubble lines inside the mug */
const BUBBLE_VARIANTS: Variants = {
  normal: {
    y: 0,
    opacity: 1,
  },
  animate: (custom: number) => ({
    y: [0, -2, 0],
    opacity: [0.35, 1, 0.35],
    transition: {
      repeat: Number.POSITIVE_INFINITY,
      duration: 1.15,
      ease: "easeInOut",
      delay: 0.18 * custom,
    },
  }),
};

/** Soft bob on the foam head */
const FOAM_VARIANTS: Variants = {
  normal: {
    y: 0,
    scale: 1,
  },
  animate: {
    y: [0, -1.2, 0],
    scale: [1, 1.04, 1],
    transition: {
      repeat: Number.POSITIVE_INFINITY,
      duration: 1.4,
      ease: "easeInOut",
    },
  },
};

const BeerIcon = forwardRef<BeerIconHandle, BeerIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave],
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          style={{ overflow: "visible" }}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Mug handle */}
          <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
          {/* Mug body */}
          <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
          {/* Foam head */}
          <motion.path
            animate={controls}
            d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"
            style={{ transformOrigin: "11px 5px" }}
            variants={FOAM_VARIANTS}
          />
          {/* Bubble / foam lines */}
          <motion.path
            animate={controls}
            custom={0}
            d="M9 12v6"
            variants={BUBBLE_VARIANTS}
          />
          <motion.path
            animate={controls}
            custom={1}
            d="M13 12v6"
            variants={BUBBLE_VARIANTS}
          />
        </svg>
      </div>
    );
  },
);

BeerIcon.displayName = "BeerIcon";

export { BeerIcon };
