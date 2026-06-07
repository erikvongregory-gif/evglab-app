"use client";

import Link from "next/link";
import React from "react";
import { cn } from "@/lib/utils";

export type StudioButtonVariant = "primary" | "ghost" | "soft";
export type StudioButtonSize = "default" | "sm" | "lg";

const btnVariantClass: Record<StudioButtonVariant, string> = {
  primary: "studio-btn-primary",
  ghost: "studio-btn-ghost",
  soft: "studio-btn-soft",
};

const btnSizeClass: Record<StudioButtonSize, string> = {
  default: "",
  sm: "studio-btn-sm",
  lg: "studio-btn-lg",
};

type StudioButtonProps = {
  variant?: StudioButtonVariant;
  size?: StudioButtonSize;
  className?: string;
  children: React.ReactNode;
} & (
  | ({ href: string } & Omit<React.ComponentProps<typeof Link>, "className" | "children">)
  | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
);

export function StudioButton({ variant = "primary", size = "default", className, style, children, ...rest }: StudioButtonProps & { style?: React.CSSProperties }) {
  const cls = cn("studio-btn", btnVariantClass[variant], btnSizeClass[size], className);
  if ("href" in rest && rest.href) {
    const { href, ...linkRest } = rest;
    return (
      <Link href={href} className={cls} style={style} {...linkRest}>
        {children}
      </Link>
    );
  }
  const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={buttonRest.type ?? "button"} className={cls} style={style} {...buttonRest}>
      {children}
    </button>
  );
}

export function StudioIconButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("studio-icon-btn", className)} {...props}>
      {children}
    </button>
  );
}

export function StudioCard({
  pad = false,
  hover = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean; hover?: boolean }) {
  return (
    <div className={cn("studio-card", pad && "studio-card-pad", hover && "studio-card-hover", className)} {...props}>
      {children}
    </div>
  );
}

export function StudioChip({
  active = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button type="button" className={cn("studio-chip", active && "on", className)} {...props}>
      {children}
    </button>
  );
}

export function StudioBadge({
  tone = "default",
  className,
  children,
}: {
  tone?: "default" | "acc" | "ok";
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn("studio-badge", tone === "acc" && "acc", tone === "ok" && "ok", className)}>{children}</span>;
}

export function StudioEyebrow({
  dot = "accent",
  className,
  children,
}: {
  dot?: "accent" | "ok" | "none";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("studio-eyebrow", className)}>
      {dot !== "none" ? <span className={cn("dot", dot === "ok" && "ok")} /> : null}
      {children}
    </div>
  );
}

export function StudioFieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("studio-field-label", className)}>{children}</span>;
}

export function StudioPageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("studio-page-header studio-pop", className)}>
      <div>
        <div className="studio-page-eyebrow">
          <span className="line" aria-hidden="true" />
          {eyebrow}
        </div>
        <h1 className="studio-page-title">{title}</h1>
        {subtitle ? <p className="studio-page-sub">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export type StudioStatIconTone = "acc" | "ok" | "blue" | "purple";

export function StudioStatCard({
  label,
  value,
  valueSuffix,
  delta,
  deltaDir = "flat",
  primary = false,
  icon,
  iconTone = "acc",
  className,
}: {
  label: string;
  value: string;
  valueSuffix?: React.ReactNode;
  delta: string;
  deltaDir?: "up" | "down" | "flat";
  primary?: boolean;
  icon?: React.ReactNode;
  iconTone?: StudioStatIconTone;
  className?: string;
}) {
  return (
    <div className={cn("studio-stat-card studio-pop", primary && "primary", className)}>
      {icon ? <div className={cn("studio-stat-icon", iconTone)}>{icon}</div> : null}
      <div className="stat-label">{label}</div>
      <div className="stat-value studio-tnum">
        {value}
        {valueSuffix}
      </div>
      <div className={cn("stat-badge-row", deltaDir === "up" && "up")}>{delta}</div>
    </div>
  );
}

export function StudioStatGrid({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("studio-stat-grid", className)} style={style}>
      {children}
    </div>
  );
}

export function StudioSparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  if (!data.length) return null;
  const width = 64;
  const height = 22;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastY = height - ((data[data.length - 1] - min) / range) * height;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <polyline points={pts} stroke="var(--acc-hi)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="2" fill="var(--acc-hi)" />
    </svg>
  );
}
