import * as React from "react";
import { cn } from "@/lib/utils";

export type StudioUiSkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: number | string;
  height?: number | string;
  radius?: "sm" | "md" | "lg" | "pill";
};

export function StudioUiSkeleton({
  className,
  width,
  height = 14,
  radius = "md",
  style,
  ...props
}: StudioUiSkeletonProps) {
  const radiusVar =
    radius === "sm"
      ? "var(--r-sm)"
      : radius === "lg"
        ? "var(--r-lg)"
        : radius === "pill"
          ? "var(--r-pill)"
          : "var(--r-md)";

  return (
    <div
      className={cn("stu-skeleton", className)}
      style={{
        width: width ?? "100%",
        height,
        borderRadius: radiusVar,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}
