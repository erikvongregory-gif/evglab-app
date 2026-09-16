import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { getGenerationJobForUser } from "@/lib/billing/generationJobs";
import { hydratePrivateAssets } from "@/lib/supabase/privateAssets";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const guard = await requireAuthenticatedUser(req, "generation-jobs");
  if (!guard.ok) return guard.response;

  const jobId = new URL(req.url).searchParams.get("id")?.trim();
  if (jobId) {
    const job = await getGenerationJobForUser(guard.userId, jobId);
    if (!job) return NextResponse.json({ error: "Auftrag nicht gefunden." }, { status: 404 });
    const result =
      job.result && typeof job.result === "object"
        ? await hydratePrivateAssets(job.result, guard.userId)
        : job.result;
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        result,
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
