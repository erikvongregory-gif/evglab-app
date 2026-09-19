"use client";

import { useEffect } from "react";

/** Forces light/dark + visible chart colors for marketing screenshots. */
export function MarketingThemeSync({ dark = false }: { dark?: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    root.setAttribute("data-theme-preset", "tangerine");
    root.style.setProperty("--chart-1", "#C7691E");
    root.style.setProperty("--chart-2", "#D4782A");
    root.style.setProperty("--color-chart-1", "#C7691E");
  }, [dark]);
  return null;
}
