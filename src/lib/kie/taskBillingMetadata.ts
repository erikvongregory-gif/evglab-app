type PendingTaskBilling = {
  consumed: number;
  createdAt: string;
  freeTrial: boolean;
};

export type PendingTaskBillingMap = Record<string, PendingTaskBilling>;

export function getPendingTaskBillingMap(
  metadata: Record<string, unknown> | null | undefined,
): PendingTaskBillingMap {
  const raw = metadata?.kie_pending_task_billing;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = Object.entries(raw as Record<string, unknown>);
  const next: PendingTaskBillingMap = {};
  for (const [taskId, value] of entries) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const rec = value as Record<string, unknown>;
    const consumed = Number(rec.consumed ?? 0);
    const createdAt = typeof rec.createdAt === "string" ? rec.createdAt : new Date().toISOString();
    const freeTrial = Boolean(rec.freeTrial);
    if (!Number.isFinite(consumed) || consumed < 0) continue;
    next[taskId] = { consumed, createdAt, freeTrial };
  }
  return next;
}

export function withPendingTask(
  metadata: Record<string, unknown> | null | undefined,
  taskId: string,
  value: PendingTaskBilling,
): Record<string, unknown> {
  const base = (metadata ?? {}) as Record<string, unknown>;
  const pending = getPendingTaskBillingMap(base);
  return {
    ...base,
    kie_pending_task_billing: {
      ...pending,
      [taskId]: value,
    },
  };
}

export function withoutPendingTask(
  metadata: Record<string, unknown> | null | undefined,
  taskId: string,
): Record<string, unknown> {
  const base = (metadata ?? {}) as Record<string, unknown>;
  const pending = getPendingTaskBillingMap(base);
  const rest = { ...pending };
  delete rest[taskId];
  return {
    ...base,
    kie_pending_task_billing: rest,
  };
}
