import { rememberJobId, requestKeyForPayload, payloadHash } from "./active-generation";

export type StartGenerationBody = {
  error?: string;
  code?: string;
  jobId?: string;
  status?: string;
  images?: { imageUrl: string }[];
  blocking_issues?: string[];
  aspectRatio?: string;
  expectedVariants?: number;
};

export type StartGenerationOutcome =
  | {
      action: "open_media";
      jobId: string;
      resume: boolean;
      aspectRatio?: string;
      expectedVariants?: number;
    }
  | { action: "stay_error"; error: string };

export function interpretStartGenerationResponse(
  status: number,
  data: StartGenerationBody,
): StartGenerationOutcome {
  const jobId = typeof data.jobId === "string" ? data.jobId.trim() : "";
  if (status === 202 && jobId) {
    return {
      action: "open_media",
      jobId,
      resume: false,
      aspectRatio: data.aspectRatio,
      expectedVariants: data.expectedVariants,
    };
  }
  if (status === 409 && jobId && data.code === "job_in_progress") {
    return {
      action: "open_media",
      jobId,
      resume: true,
      aspectRatio: data.aspectRatio,
      expectedVariants: data.expectedVariants,
    };
  }
  if (status === 200 && jobId) {
    return {
      action: "open_media",
      jobId,
      resume: true,
      aspectRatio: data.aspectRatio,
      expectedVariants: data.expectedVariants,
    };
  }
  const issues = Array.isArray(data.blocking_issues) ? data.blocking_issues.filter(Boolean) : [];
  return {
    action: "stay_error",
    error: issues[0] || data.error || "Generierung fehlgeschlagen.",
  };
}

export async function startStudioGeneration(args: {
  url: string;
  payload: unknown;
  fetch?: typeof fetch;
}): Promise<StartGenerationOutcome> {
  const requestKey = requestKeyForPayload(payloadHash(args.payload));
  const fetchFn = args.fetch ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(args.url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey },
      body: JSON.stringify(args.payload),
    });
  } catch {
    return { action: "stay_error", error: "Netzwerkfehler. Bitte denselben Auftrag erneut senden — es entsteht kein zweites Motiv." };
  }

  let data: StartGenerationBody = {};
  try {
    data = (await res.json()) as StartGenerationBody;
  } catch {
    return { action: "stay_error", error: "Antwort unklar. Bitte denselben Auftrag erneut senden — es entsteht kein zweites Motiv." };
  }

  const outcome = interpretStartGenerationResponse(res.status, data);
  if (outcome.action === "open_media") {
    rememberJobId(outcome.jobId, {
      aspectRatio: outcome.aspectRatio,
      variantCount: outcome.expectedVariants,
    });
  }
  return outcome;
}

export function mediaLibraryHref(jobId: string) {
  return `/dashboard/media?job=${encodeURIComponent(jobId)}`;
}
