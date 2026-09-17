export type MediaJobStatus = "reserved" | "completed" | "failed";

export type MediaJobCard = {
  jobId: string;
  status: MediaJobStatus;
  phase: string;
  aspectRatio: string;
  expectedVariants: number;
  images: { imageUrl: string }[];
  error?: string;
  connectionIssue?: boolean;
  pending?: boolean;
  partial?: boolean;
  highlighted?: boolean;
};

export function mediaIdForJobVariant(jobId: string, index: number) {
  return `gen-${jobId}-${index}`;
}

export function isMediaIdForJob(mediaId: string, jobId: string) {
  return mediaId.startsWith(`gen-${jobId}-`);
}

/** Jobkarte nur solange zeigen, bis gespeicherte Medien denselben Auftrag ersetzen. */
export function shouldShowJobCard(
  job: Pick<MediaJobCard, "jobId" | "status" | "images">,
  mediaIds: Iterable<string>,
) {
  const ids = mediaIds instanceof Set ? mediaIds : new Set(mediaIds);
  const persisted = job.images.some((_, index) => ids.has(mediaIdForJobVariant(job.jobId, index)))
    || [...ids].some((id) => isMediaIdForJob(id, job.jobId));
  if (job.status === "reserved") return true;
  if (job.status === "failed" && job.images.length === 0) return !persisted;
  return !persisted;
}

export function leadingMediaForJobs<T extends { id: string }>(jobs: Array<{ jobId: string }>, items: T[]) {
  const seen = new Set<string>();
  const leading: T[] = [];
  for (const job of jobs) {
    for (const item of items) {
      if (seen.has(item.id) || !isMediaIdForJob(item.id, job.jobId)) continue;
      seen.add(item.id);
      leading.push(item);
    }
  }
  return { leading, seen };
}

export function jobAspectStyle(aspectRatio: string | undefined) {
  const ratio = (aspectRatio || "4:5").replace(":", " / ");
  return { aspectRatio: ratio };
}
