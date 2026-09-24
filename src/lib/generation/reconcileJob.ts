import { finishGeneration, type GenerationJob } from "@/lib/billing/generationJobs";
import { persistGeneratedMediaItems } from "@/lib/dashboard/persistGeneratedMedia";
import { createModelArkClient, isModelArkRequestId } from "@/lib/generation";
import type { GenerationPlane } from "@/lib/generation/catalog/types";

export async function reconcileModelArkJob(job: GenerationJob & { provider_task_id: string }) {
  if (!isModelArkRequestId(job.provider_task_id)) {
    throw new Error("Kein ModelArk-Request.");
  }
  const status = await createModelArkClient().status(job.provider_task_id);
  const plane = (job.result as { plane?: GenerationPlane } | null)?.plane;
  const tokenCost =
    typeof (job.result as { tokenCost?: number } | null)?.tokenCost === "number"
      ? (job.result as { tokenCost: number }).tokenCost
      : job.amount;

  if (status.status === "completed" && status.video?.url) {
    const mediaItems = await persistGeneratedMediaItems({
      userId: job.user_id,
      jobId: job.id,
      images: [status.video.url],
      title: "Video",
      prompt: plane?.prompt.text?.slice(0, 240) || "Video",
      aspectRatio:
        typeof plane?.settings.aspectRatio === "string" ? plane.settings.aspectRatio : "16:9",
      resolution: "1K",
      outputFormat: "png",
    });
    await finishGeneration(job, tokenCost, {
      phase: "completed",
      provider: "modelark",
      plane,
      requestId: job.provider_task_id,
      videoUrl: status.video.url,
      video: { url: status.video.url },
      mediaPersisted: mediaItems.length > 0,
    });
    return status;
  }

  if (["failed", "nsfw", "canceled"].includes(status.status)) {
    await finishGeneration(job, 0, {
      phase: "failed",
      provider: "modelark",
      plane,
      requestId: job.provider_task_id,
      error: typeof status.error === "string" ? status.error : "Generierung fehlgeschlagen.",
    });
  }

  return status;
}
