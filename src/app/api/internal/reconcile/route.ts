import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finishGeneration, type GenerationJob } from "@/lib/billing/generationJobs";
import { reconcileKieJob } from "@/lib/kie/reconcileJob";
import { reconcileModelArkJob } from "@/lib/generation/reconcileJob";
import { isModelArkRequestId } from "@/lib/generation";
import { deleteAccount } from "@/lib/dashboard/deleteAccount";
export const runtime="nodejs";
export const maxDuration=300;
export async function POST(req: Request) {
  const expected=process.env.CRON_SECRET;
  const actual=req.headers.get("authorization")??"";
  if(!expected || Buffer.byteLength(actual)!==Buffer.byteLength(`Bearer ${expected}`)||!timingSafeEqual(Buffer.from(actual),Buffer.from(`Bearer ${expected}`)))return NextResponse.json({error:"Nicht autorisiert."},{status:401});
  const admin=createAdminClient();
  const jobs=await admin.from("generation_jobs").select("*").eq("status","reserved").order("created_at").limit(10);
  if(jobs.error)return NextResponse.json({error:"Jobprüfung fehlgeschlagen."},{status:503});
  let errors=0;
  for(const row of jobs.data??[]) {
    try {
      if(row.provider_task_id && isModelArkRequestId(row.provider_task_id))await reconcileModelArkJob(row);
      else if(row.provider_task_id)await reconcileKieJob(row);
      else if(Date.parse(row.created_at)<Date.now()-30*60*1000) {
        const images=Array.isArray(row.result?.images)?row.result.images:[];
        const cost=Number(row.result?.perVariantCost??0);
        await finishGeneration(row as GenerationJob,Math.min(row.amount,images.length*cost),{...row.result,images,error:images.length?undefined:"Auftrag abgebrochen; Reservierung freigegeben."});
      }
    }catch { errors++; }
  }
  const deletions=await admin.from("account_deletion_jobs").select("user_id").order("created_at").limit(5);
  if(deletions.error)errors++;
  for(const row of deletions.data??[])try {await deleteAccount(row.user_id);}catch{errors++;}
  return NextResponse.json({checked:jobs.data?.length??0,errors},{status:errors?503:200});
}
