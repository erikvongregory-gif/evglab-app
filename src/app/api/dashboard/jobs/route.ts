import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(req:Request) {
  const guard=await requireAuthenticatedUser(req,"generation-jobs");if(!guard.ok)return guard.response;
  const {data,error}=await createAdminClient().from("generation_jobs").select("id,status,result,created_at,charged,provider_task_id")
    .eq("user_id",guard.userId).order("created_at",{ascending:false}).limit(50);
  if(error)return NextResponse.json({error:"Aufträge konnten nicht geladen werden."},{status:503});
  return NextResponse.json({jobs:data});
}
