import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { getGenerationJobForUser } from "@/lib/billing/generationJobs";
import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileKieJob } from "@/lib/kie/reconcileJob";

function resultImages(result: Record<string, unknown> | null | undefined) {
  const images = result && Array.isArray(result.images) ? result.images : [];
  return images.length;
}

export async function GET(req: Request) {
  const guard = await requireAuthenticatedUser(req, "generation-jobs");
  if (!guard.ok) return guard.response;

  const jobId = new URL(req.url).searchParams.get("id")?.trim();
  if (jobId) {
    let job = await getGenerationJobForUser(guard.userId, jobId);
    if (!job) return NextResponse.json({ error: "Auftrag nicht gefunden." }, { status: 404 });
    const createdAt = job.created_at ? Date.parse(job.created_at) : 0;
    const stale = createdAt > 0 && Date.now() - createdAt > 4 * 60_000;
    if (stale && job.status === "reserved" && job.provider_task_id && resultImages(job.result) === 0) {
      try {
        await reconcileKieJob({ ...job, provider_task_id: job.provider_task_id });
        job = (await getGenerationJobForUser(guard.userId, jobId)) ?? job;
      } catch {
        /* Provider noch nicht fertig */
      }
    }
    const result =
      job.result && typeof job.result === "object"
        ? await hydratePrivateAssets(job.result, guard.userId)
        : job.result;
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        result,
        created_at: job.created_at,
      },
    });
  }

  const { data, error } = await createAdminClient()
    .from("generation_jobs")
    .select("id,status,result,created_at,charged,provider_task_id")
    .eq("user_id", guard.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "Aufträge konnten nicht geladen werden." }, { status: 503 });
  return NextResponse.json({ jobs: data });
}
