"use client";

import React from "react";

const SW = 1.75;

export function StudioIcon({ name, size = 18 }: { name: string; size?: number }) {
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
  };

  switch (name) {
    case "grid":
    case "dash":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "sparkles":
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3 L13.2 8.8 L19 10 L13.2 11.2 L12 17 L10.8 11.2 L5 10 L10.8 8.8 Z" />
        </svg>
      );
    case "image":
    case "media":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 16 L8 11 L12 15 L16 11 L21 16" />
          <circle cx="16.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "users":
    case "team":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 19 C3 16 5.5 14.5 9 14.5 C12.5 14.5 15 16 15 19 M14 19 C14 16.5 15.5 15 17 15 C18.5 15 20 16.5 20 19" />
        </svg>
      );
    case "shield":
    case "brand":
      return (
        <svg {...common}>
          <path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z" />
        </svg>
      );
    case "settings":
    case "gear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.2 4.2 L6.3 6.3 M17.7 17.7 L19.8 19.8 M4.2 19.8 L6.3 17.7 M17.7 6.3 L19.8 4.2" />
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
    default:
      return <svg {...common}><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>;
  }
}
