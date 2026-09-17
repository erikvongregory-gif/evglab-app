"use client";

// 21st.dev: bundui/badge10 pattern (demo id 25370) — removable tone chips
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RemovableBadgeItem = { id: string; label: string };

export function RemovableBadges({
  items,
  onRemove,
  className,
}: {
  items: RemovableBadgeItem[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((badge) => (
        <Badge key={badge.id} className="gap-0 rounded-md px-2 py-1" variant="outline">
          {badge.label}
          <button
            aria-label={`${badge.label} entfernen`}
            className="-my-[5px] -me-2 -ms-0.5 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[inherit] p-0 text-foreground/60 outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={() => onRemove(badge.id)}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </Badge>
      ))}
    </div>
  );
}
