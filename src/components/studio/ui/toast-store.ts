export type StudioUiToastTone = "success" | "error" | "warning" | "info";

export type StudioUiToastInput = {
  title: string;
  description?: string;
  tone?: StudioUiToastTone;
  /** Standzeit in ms (Handoff default 4200) */
  durationMs?: number;
};

export type StudioUiToastItem = StudioUiToastInput & {
  id: string;
  tone: StudioUiToastTone;
  durationMs: number;
  createdAt: number;
};

type Listener = (items: StudioUiToastItem[]) => void;

let seq = 0;
let items: StudioUiToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(items);
}

export function subscribeStudioToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(items);
  return () => listeners.delete(listener);
}

export function getStudioToasts(): StudioUiToastItem[] {
  return items;
}

export function dismissStudioToast(id: string) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function clearStudioToasts() {
  items = [];
  emit();
}

/** Studio-scoped Toast (kein App-Global-Toaster). Keine technischen Fehlerdetails. */
export function showStudioToast(input: StudioUiToastInput): string {
  const id = `stu-toast-${++seq}`;
  const item: StudioUiToastItem = {
    id,
    title: input.title,
    description: input.description,
    tone: input.tone ?? "info",
    durationMs: input.durationMs ?? 4200,
    createdAt: Date.now(),
  };
  items = [...items, item].slice(-4);
  emit();
  return id;
}
