import { finishGeneration, type GenerationJob } from "@/lib/billing/generationJobs";
import { extractTaskMedia } from "./taskResponse";
import { parseUpstreamProgress } from "./generationProgress";
export async function reconcileKieJob(job: GenerationJob & { provider_task_id: string }) {
  const apiKey=process.env.KIE_API_KEY;
  if(!apiKey)throw new Error("Kie ist nicht konfiguriert.");
  const upstream=await fetch(`${process.env.KIE_API_BASE_URL||"https://api.kie.ai"}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(job.provider_task_id)}`,{
    headers:{Authorization:`Bearer ${apiKey}`},cache:"no-store",signal:AbortSignal.timeout(15000),
  });
  if(!upstream.ok)throw new Error("Providerstatus derzeit nicht verfügbar.");
  const data=await upstream.json() as Record<string,unknown>;
  const payload=(data.data??{}) as Record<string,unknown>;
  const state=String(data.state||data.status||payload.state||payload.status||"unknown").toLowerCase();
  const media=extractTaskMedia(payload,data);
  const result={state,...media,progress:parseUpstreamProgress(payload,state)??(media.mediaUrl?100:null)};
  if(["failed","error","cancelled","canceled"].includes(state))await finishGeneration(job,0,result);
  else if(["success","succeeded","completed","done"].includes(state) && (media.mediaUrl||media.imageUrl||media.videoUrl))await finishGeneration(job,job.amount,result);
  return result;
}
