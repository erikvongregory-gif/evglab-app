"use client";

// 21st.dev: ravikatiyar162/color-palette-card (demo id 5402)
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ColorPaletteCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hex codes without leading `#` */
  colors: string[];
  statsText: string;
  icon?: React.ReactNode;
}

const ColorPaletteCard = React.forwardRef<HTMLDivElement, ColorPaletteCardProps>(
  ({ className, colors, statsText, icon, ...props }, ref) => {
    const defaultIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 18 18"
        className="fill-current"
        aria-hidden="true"
      >
        <path d="M4 7.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5S5.5 9.83 5.5 9 4.83 7.5 4 7.5zm10 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm-5 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5S9.83 7.5 9 7.5z" />
      </svg>
    );

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full min-h-[160px] w-full flex-col overflow-hidden rounded-xl bg-card font-sans shadow-sm",
          className,
        )}
        {...props}
      >
        <div className="flex min-h-0 w-full flex-1">
          {colors.map((color) => (
            <div
              key={color}
              className="group flex h-full flex-1 items-center justify-center font-semibold tracking-wider text-white transition-[flex] duration-200 ease-in-out hover:flex-[2]"
              style={{ backgroundColor: `#${color.replace(/^#/, "")}` }}
            >
              <span className="text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:text-sm">
                {color.replace(/^#/, "").toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 bg-card px-4 py-2.5 text-muted-foreground md:px-5">
          <span className="truncate text-xs md:text-sm">{statsText}</span>
          {icon || defaultIcon}
        </div>
      </div>
    );
  },
);

ColorPaletteCard.displayName = "ColorPaletteCard";

export { ColorPaletteCard };
