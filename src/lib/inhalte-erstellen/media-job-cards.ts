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
  // Fehlgeschlagene Versuche gehören nicht in die Mediathek (Fehler bleibt im Studio).
  if (job.status === "failed") return false;
  const ids = mediaIds instanceof Set ? mediaIds : new Set(mediaIds);
  const persisted = job.images.some((_, index) => ids.has(mediaIdForJobVariant(job.jobId, index)))
    || [...ids].some((id) => isMediaIdForJob(id, job.jobId));
  if (job.status === "reserved") return true;
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

export function jobAspectStyle(aspectRatio: string | undefined): { aspectRatio: string } {
  const parts = parseAspectRatio(aspectRatio);
  if (!parts) return { aspectRatio: "4 / 5" };
  return { aspectRatio: `${parts.w} / ${parts.h}` };
}

/** Width/height from "16:9", "4/5", or a unitless ratio. */
export function parseAspectRatio(aspectRatio: string | undefined): { w: number; h: number } | null {
  const raw = (aspectRatio || "4:5").trim().toLowerCase();
  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^(\d+(?:\.\d+)?)[/:](\d+(?:\.\d+)?)$/);
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w > 0 && h > 0) return { w, h };
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(compact)) {
    const w = Number(compact);
    if (w > 0) return { w, h: 1 };
  }
  return null;
}

export function isLandscapeAspect(aspectRatio: string | undefined) {
  const parts = parseAspectRatio(aspectRatio);
  if (!parts) return false;
  return parts.w / parts.h >= 1;
}
