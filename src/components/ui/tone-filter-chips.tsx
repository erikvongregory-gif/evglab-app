"use client";

// 21st.dev: cnippet-dev/v-toggle-10 — Role Filter Chips (demo id 22213)
// Angepasst für Marken-Tonalität

import { SlidersHorizontal } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

export type ToneFilterChipsProps = {
  tags: string[];
  onChange?: (tags: string[]) => void;
  className?: string;
};

export function ToneFilterChips({ tags, onChange, className }: ToneFilterChipsProps) {
  const editable = typeof onChange === "function";

  function toggle(tag: string) {
    if (!editable) return;
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  }

  function clear() {
    if (!editable) return;
    onChange([]);
  }

  const items = tags.length > 0 ? tags : [];

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-[var(--t3)]">
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          <span>Stimme der Marke</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--t3)]">
            {tags.length} {tags.length === 1 ? "Eigenschaft" : "Eigenschaften"}
          </span>
          {editable && tags.length > 0 ? (
            <button
              type="button"
              className="text-xs text-[var(--t3)] underline-offset-2 hover:text-[var(--t1)] hover:underline"
              onClick={clear}
            >
              Zurücksetzen
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((tag) => {
            const isActive = tags.includes(tag);
            return (
              <Toggle
                key={tag}
                aria-label={`Tonalität ${tag}`}
                className="gap-1.5 rounded-full px-3.5"
                pressed={isActive}
                onPressedChange={() => toggle(tag)}
                disabled={!editable}
                size="sm"
                variant="outline"
              >
                {tag}
              </Toggle>
            );
          })
        ) : (
          <span className="text-sm text-[var(--t3)]">Noch keine Tonalität hinterlegt</span>
        )}
      </div>
    </div>
  );
}
