"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  dismissStudioToast,
  showStudioToast,
  subscribeStudioToasts,
  type StudioUiToastItem,
  type StudioUiToastInput,
} from "./toast-store";

export { showStudioToast, dismissStudioToast, type StudioUiToastInput, type StudioUiToastItem };

export function StudioUiToaster({ className }: { className?: string }) {
  const [toasts, setToasts] = React.useState<StudioUiToastItem[]>([]);

  React.useEffect(() => subscribeStudioToasts(setToasts), []);

  React.useEffect(() => {
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismissStudioToast(t.id), t.durationMs),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className={cn("stu-toaster", className)} aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn("stu-toast", `stu-toast--${t.tone}`)}
          role={t.tone === "error" ? "alert" : "status"}
        >
          <div className="stu-toast__body">
            <div className="stu-toast__title">{t.title}</div>
            {t.description ? <div className="stu-toast__desc">{t.description}</div> : null}
          </div>
          <button
            type="button"
            className="stu-toast__close"
            aria-label="Toast schließen"
            onClick={() => dismissStudioToast(t.id)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
