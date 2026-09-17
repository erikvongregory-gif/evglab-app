"use client";

// 21st.dev: bundui/progress7 — Storage Usage Progress (demo id 22139)
// Farben für Profilstärke invertiert: hoch = grün, niedrig = rot

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ProfileStrengthProgressProps = {
  value: number;
  statusLabel: string;
  label?: string;
  className?: string;
};

function barColor(value: number) {
  if (value >= 65) return "bg-green-500";
  if (value >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function badgeVariant(value: number): "success" | "secondary" | "destructive" {
  if (value >= 65) return "success";
  if (value >= 40) return "secondary";
  return "destructive";
}

export function ProfileStrengthProgress({
  value,
  statusLabel,
  label = "Profilstärke",
  className,
}: ProfileStrengthProgressProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={cn("w-full max-w-md space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--t2)]">{label}</span>
        <Badge variant={badgeVariant(percent)}>{statusLabel}</Badge>
      </div>
      <Progress
        value={percent}
        className="h-2 bg-[var(--s3)]"
        indicatorClassName={barColor(percent)}
      />
      <div className="flex items-center justify-end text-xs text-[var(--t3)]">
        <span className="tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}
