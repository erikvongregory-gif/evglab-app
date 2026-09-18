"use client";

import React from "react";
import {
  AnimatedStudioIcon,
  hasAnimatedStudioIcon,
} from "@/components/ui/animated-studio-icon";

const SW = 1.5;

export function StudioIcon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  if (hasAnimatedStudioIcon(name)) {
    return <AnimatedStudioIcon name={name} size={size} className={className} />;
  }

  const s = size;
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: SW,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };

  switch (name) {
    case "grid":
    case "dash":
      return (
        <svg {...common}>
          <path d="M22 10.9 V4.1 C22 2.6 21.36 2 19.77 2 H15.73 C14.14 2 13.5 2.6 13.5 4.1 V10.9 C13.5 12.4 14.14 13 15.73 13 H19.77 C21.36 13 22 12.4 22 10.9 Z" />
          <path d="M22 19.9 V18.1 C22 16.6 21.36 16 19.77 16 H15.73 C14.14 16 13.5 16.6 13.5 18.1 V19.9 C13.5 21.4 14.14 22 15.73 22 H19.77 C21.36 22 22 21.4 22 19.9 Z" />
          <path d="M10.5 13.1 V19.9 C10.5 21.4 9.86 22 8.27 22 H4.23 C2.64 22 2 21.4 2 19.9 V13.1 C2 11.6 2.64 11 4.23 11 H8.27 C9.86 11 10.5 11.6 10.5 13.1 Z" />
          <path d="M10.5 4.1 V5.9 C10.5 7.4 9.86 8 8.27 8 H4.23 C2.64 8 2 7.4 2 5.9 V4.1 C2 2.6 2.64 2 4.23 2 H8.27 C9.86 2 10.5 2.6 10.5 4.1 Z" />
        </svg>
      );
    case "sparkles":
    case "spark":
      return (
        <svg {...common}>
          <path d="M3.5 20.5 C4.33 21.33 5.67 21.33 6.5 20.5 L19.5 7.5 C20.33 6.67 20.33 5.33 19.5 4.5 C18.67 3.67 17.33 3.67 16.5 4.5 L3.5 17.5 C2.67 18.33 2.67 19.67 3.5 20.5 Z" />
          <path d="M18.01 8.99 L15.01 5.99" />
          <path d="M8.5 2.44 L10 2 L9.56 3.5 L10 5 L8.5 4.56 L7 5 L7.44 3.5 L7 2 L8.5 2.44 Z" />
          <path d="M4.5 8.44 L6 8 L5.56 9.5 L6 11 L4.5 10.56 L3 11 L3.44 9.5 L3 8 L4.5 8.44 Z" />
          <path d="M19.5 13.44 L21 13 L20.56 14.5 L21 16 L19.5 15.56 L18 16 L18.44 14.5 L18 13 L19.5 13.44 Z" />
        </svg>
      );
    case "image":
    case "media":
      return (
        <svg {...common}>
          <path d="M9 22 H15 C20 22 22 20 22 15 V9 C22 4 20 2 15 2 H9 C4 2 2 4 2 9 V15 C2 20 4 22 9 22 Z" />
          <path d="M9 10 C10.1046 10 11 9.10457 11 8 C11 6.89543 10.1046 6 9 6 C7.89543 6 7 6.89543 7 8 C7 9.10457 7.89543 10 9 10 Z" />
          <path d="M2.67 18.95 L7.6 15.64 C8.39 15.11 9.53 15.17 10.24 15.78 L10.57 16.07 C11.35 16.74 12.61 16.74 13.39 16.07 L17.55 12.5 C18.33 11.83 19.59 11.83 20.37 12.5 L22 13.9" />
        </svg>
      );
    case "users":
    case "team":
      return (
        <svg {...common}>
          <path d="M9.16 10.87 C9.06 10.86 8.94 10.86 8.83 10.87 C6.45 10.79 4.56 8.84 4.56 6.44 C4.56 3.99 6.54 2 9 2 C11.45 2 13.44 3.99 13.44 6.44 C13.43 8.84 11.54 10.79 9.16 10.87 Z" />
          <path d="M16.41 4 C18.35 4 19.91 5.57 19.91 7.5 C19.91 9.39 18.41 10.93 16.54 11 C16.46 10.99 16.37 10.99 16.28 11" />
          <path d="M4.16 14.56 C1.74 16.18 1.74 18.82 4.16 20.43 C6.91 22.27 11.42 22.27 14.17 20.43 C16.59 18.81 16.59 16.17 14.17 14.56 C11.43 12.73 6.92 12.73 4.16 14.56 Z" />
          <path d="M18.34 20 C19.06 19.85 19.74 19.56 20.3 19.13 C21.86 17.96 21.86 16.03 20.3 14.86 C19.75 14.44 19.08 14.16 18.37 14" />
        </svg>
      );
    case "shield":
    case "brand":
      return (
        <svg {...common}>
          <path d="M14 16 C14 17.77 13.23 19.37 12 20.46 C10.94 21.42 9.54 22 8 22 C4.69 22 2 19.31 2 16 C2 13.24 3.88 10.9 6.42 10.21 C7.11 11.95 8.59 13.29 10.42 13.79 C10.92 13.93 11.45 14 12 14 C12.55 14 13.08 13.93 13.58 13.79 C13.85 14.47 14 15.22 14 16 Z" />
          <path d="M18 8 C18 8.78 17.85 9.53 17.58 10.21 C16.89 11.95 15.41 13.29 13.58 13.79 C13.08 13.93 12.55 14 12 14 C11.45 14 10.92 13.93 10.42 13.79 C8.59 13.29 7.11 11.95 6.42 10.21 C6.15 9.53 6 8.78 6 8 C6 4.69 8.69 2 12 2 C15.31 2 18 4.69 18 8 Z" />
          <path d="M22 16 C22 19.31 19.31 22 16 22 C14.46 22 13.06 21.42 12 20.46 C13.23 19.37 14 17.77 14 16 C14 15.22 13.85 14.47 13.58 13.79 C15.41 13.29 16.89 11.95 17.58 10.21 C20.12 10.9 22 13.24 22 16 Z" />
        </svg>
      );
    case "settings":
    case "gear":
      return (
        <svg {...common}>
          <path d="M12 15 C13.6569 15 15 13.6569 15 12 C15 10.3431 13.6569 9 12 9 C10.3431 9 9 10.3431 9 12 C9 13.6569 10.3431 15 12 15 Z" />
          <path d="M2 12.88 V11.12 C2 10.08 2.85 9.22 3.9 9.22 C5.71 9.22 6.45 7.94 5.54 6.37 C5.02 5.47 5.33 4.3 6.24 3.78 L7.97 2.79 C8.76 2.32 9.78 2.6 10.25 3.39 L10.36 3.58 C11.26 5.15 12.74 5.15 13.65 3.58 L13.76 3.39 C14.23 2.6 15.25 2.32 16.04 2.79 L17.77 3.78 C18.68 4.3 18.99 5.47 18.47 6.37 C17.56 7.94 18.3 9.22 20.11 9.22 C21.15 9.22 22.01 10.07 22.01 11.12 V12.88 C22.01 13.92 21.16 14.78 20.11 14.78 C18.3 14.78 17.56 16.06 18.47 17.63 C18.99 18.54 18.68 19.7 17.77 20.22 L16.04 21.21 C15.25 21.68 14.23 21.4 13.76 20.61 L13.65 20.42 C12.75 18.85 11.27 18.85 10.36 20.42 L10.25 20.61 C9.78 21.4 8.76 21.68 7.97 21.21 L6.24 20.22 C5.33 19.7 5.02 18.53 5.54 17.63 C6.45 16.06 5.71 14.78 3.9 14.78 C2.85 14.78 2 13.92 2 12.88 Z" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5 C9.5 7.8 10.8 6.5 12.5 6.5 C14.2 6.5 15.5 7.8 15.5 9.5 C15.5 11.5 12.5 12 12.5 14" />
          <circle cx="12.5" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "chevD":
      return (
        <svg {...common}>
          <path d="M6 9 L12 15 L18 9" />
        </svg>
      );
    case "chevR":
      return (
        <svg {...common}>
          <path d="M9 6 L15 12 L9 18" />
        </svg>
      );
    case "chevL":
      return (
        <svg {...common}>
          <path d="M15 6 L9 12 L15 18" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M5 12.5 L9.5 17 L19 7" />
        </svg>
      );
    case "arrowR":
      return (
        <svg {...common}>
          <path d="M5 12 H19 M13 6 L19 12 L13 18" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2 L5 14 H11 L10 22 L19 10 H13 Z" />
        </svg>
      );
    case "coins":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7 V13 C5 14.7 8.1 16 12 16 C15.9 16 19 14.7 19 13 V7" />
          <path d="M5 10 C5 11.7 8.1 13 12 13 C15.9 13 19 11.7 19 10" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...common}>
          <path d="M12 15 C12 15 8 11 8 6 C8 6 12 8 16 6 C16 11 12 15 12 15 Z" />
          <path d="M12 15 L12 21" />
          <path d="M9 18 L12 21 L15 18" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5 V19 M5 12 H19" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 10 C6 6.7 8.7 4 12 4 C15.3 4 18 6.7 18 10 V15 L20 18 H4 L6 15 Z" />
          <path d="M9.5 18 C9.8 19.4 10.7 20.5 12 20.5 C13.3 20.5 14.2 19.4 14.5 18" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16 L20 20" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12 H21 M12 3 C9 7 9 17 12 21 M12 3 C15 7 15 17 12 21" />
        </svg>
      );
    case "link":
    case "refresh":
      return (
        <svg {...common}>
          <path d="M10 5 H16 V11 M14 10 C11.5 6.5 6.5 6.5 4 10 C1.5 13.5 4 19 9 19 H14 M14 19 H8 V13 M10 14 C12.5 17.5 17.5 17.5 20 14 C22.5 10.5 20 5 15 5 H10" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="M16 4 L20 8 L9 19 H5 V15 Z" />
          <path d="M13 7 L17 11" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M6 6 L18 18 M18 6 L6 18" />
        </svg>
      );
    /** Iconsax Linear — cup (Sortenauswahl) */
    case "cup":
      return (
        <svg {...common}>
          <path d="M6 8.5 H18" />
          <path d="M6.5 8.5 V9.5 C6.5 12.54 8.96 15 12 15 C15.04 15 17.5 12.54 17.5 9.5 V8.5" />
          <path d="M9 8.5 V5.5 C9 4.67 9.67 4 10.5 4 H13.5 C14.33 4 15 4.67 15 5.5 V8.5" />
          <path d="M12 15 V19" />
          <path d="M9.5 21 H14.5" />
        </svg>
      );
    /** Iconsax Linear — profile / user (Charakter) */
    case "user":
      return (
        <svg {...common}>
          <path d="M12.16 10.87 C12.06 10.86 11.94 10.86 11.83 10.87 C9.45 10.79 7.56 8.84 7.56 6.44 C7.56 3.99 9.54 2 12 2 C14.45 2 16.44 3.99 16.44 6.44 C16.43 8.84 14.54 10.79 12.16 10.87 Z" />
          <path d="M7.16 14.56 C4.74 16.18 4.74 18.82 7.16 20.43 C9.91 22.27 14.42 22.27 17.17 20.43 C19.59 18.81 19.59 16.17 17.17 14.56 C14.43 12.73 9.92 12.73 7.16 14.56 Z" />
        </svg>
      );
    default:
      return <svg {...common}><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>;
  }
}
