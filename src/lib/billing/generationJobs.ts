import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isOwnerUserId } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOwnerBillingRow, type BillingRow } from "./store";

export type GenerationJob = { id: string; user_id: string; amount: number; status: string; result: Record<string, unknown> | null; owner?: boolean };
export async function reserveGeneration(req: Request, userId: string, amount: number, payload: unknown): Promise<GenerationJob | NextResponse> {
  const owner = await isOwnerUserId(userId);
  const key = req.headers.get("idempotency-key") ?? randomUUID();
  if (!/^[\w:-]{1,160}$/.test(key)) return NextResponse.json({ error: "Ungültiger Auftragsschlüssel." }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("generation_reserve", {
    p_id: randomUUID(), p_user_id: userId, p_key: key,
    p_hash: createHash("sha256").update(new URL(req.url).pathname + JSON.stringify(payload)).digest("hex"), p_amount: owner ? 0 : amount,
  });
  if (error) return NextResponse.json({ error: "Auftrag konnte nicht reserviert werden. Bitte Guthaben prüfen.", code: "reservation_failed" }, { status: 409 });
  if (!data?.fresh) {
    if (["completed","failed"].includes(data?.job?.status) && data?.job?.result) return NextResponse.json(await hydratePrivateAssets(data.job.result,userId));
    return NextResponse.json({ error: "Dieser Auftrag wird bereits verarbeitet.", jobId: data?.job?.id }, { status: 409 });
  }
  return { ...data.job, owner } as GenerationJob;
}

export async function finishGeneration(job: GenerationJob, charged: number, result: Record<string, unknown>): Promise<{ ok: true; state: BillingRow }> {
  const { data, error } = await createAdminClient().rpc("generation_finish", {
    p_id: job.id, p_user_id: job.user_id, p_charged: job.owner ? 0 : charged, p_result: result,
  });
  if (error || !data?.[0]) throw new Error("Auftragsabschluss ausstehend. Bitte den Auftrag nicht erneut starten.");
  return { ok: true, state: job.owner ? buildOwnerBillingRow(job.user_id) : data[0] as BillingRow };
}

export async function linkProviderTask(job: GenerationJob, taskId: string) {
  const { error } = await createAdminClient().from("generation_jobs").update({ provider_task_id: taskId })
    .eq("id", job.id).eq("user_id", job.user_id).eq("status", "reserved");
  if (error) throw new Error("Task-Zuordnung ausstehend; bitte Support kontaktieren.");
}

export async function saveGenerationProgress(job: GenerationJob, images: string[], perVariantCost: number) {
  const { error } = await createAdminClient().from("generation_jobs").update({result:{images:images.map(imageUrl=>({imageUrl})),perVariantCost}}).eq("id",job.id).eq("user_id",job.user_id).eq("status","reserved");
  if(error)throw new Error("Zwischenergebnis konnte nicht gespeichert werden.");
}
