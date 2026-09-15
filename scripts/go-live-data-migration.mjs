import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Read-only unless --apply is explicitly supplied. Load env using Node's --env-file.
const apply=process.argv.includes("--apply");
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Supabase URL/service role configuration missing.");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucketName=process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim()||"generated-images";
const bucket=admin.storage.from(bucketName);
for(const table of ["dashboard_media","integration_secrets","token_lots","generation_jobs","workspace_members","workspace_invites","account_deletion_jobs","billing_checkout_locks"]){
  const result=await admin.from(table).select("*",{head:true,count:"exact"});
  if(result.error)throw new Error(`Migration/preflight failed for ${table}: ${result.error.code}`);
}
const billingUsers=new Set();
for(let from=0;;from+=1000){
  const page=await admin.from("billing_subscriptions").select("user_id").range(from,from+999);
  if(page.error)throw page.error;
  for(const row of page.data??[])billingUsers.add(row.user_id);
  if((page.data??[]).length<1000)break;
}
let authUsers=0,users=0,media=0,credentials=0,pendingLegacyJobs=0,legacyIndexesPreserved=0;
for(let page=1;;page++) {
  const listing=await admin.auth.admin.listUsers({page,perPage:100});
  if(listing.error)throw listing.error;
  if(!listing.data.users.length)break;
  for(const user of listing.data.users){
    authUsers++;
    const metadata=user.user_metadata??{};
    const legacyPath=`media-library/${user.id}.json`;
    const download=await bucket.download(legacyPath);
    let oldItems=[];
    if(download.data){oldItems=JSON.parse(await download.data.text());if(!Array.isArray(oldItems))throw new Error("Invalid legacy media index; migration stopped.");}
    else if(download.error && !["400","404"].includes(String(download.error.statusCode)))throw new Error("Could not read legacy media index; migration stopped.");
    const isBrewAiUser=billingUsers.has(user.id)||oldItems.length>0||metadata.dashboard||metadata.brewery||metadata.brewery_name;
    if(!isBrewAiUser)continue;
    users++;
    if(oldItems.length)legacyIndexesPreserved++;
    if(Object.keys(metadata.kie_pending_task_billing??{}).length){
      pendingLegacyJobs++;
      if(apply)throw new Error("Legacy generation jobs still pending. Drain/reconcile before migration.");
    }
    const items=[...(Array.isArray(metadata.dashboard?.mediaLibrary)?metadata.dashboard.mediaLibrary:[]),...oldItems];
    const unique=[...new Map(items.map(item=>[item.id,item])).values()];
    if(unique.some(item=>typeof item.id!=="string"||!item.id))throw new Error("Invalid media identity; migration stopped.");
    media+=unique.length;
    if(metadata.instagramConnection||metadata.dashboard?.instagramConnection)credentials++;
    if(!apply)continue;
    const billing=await admin.from("billing_subscriptions").select("stripe_subscription_id,token_anchor").eq("user_id",user.id).maybeSingle();
    if(billing.error)throw billing.error;
    if(billing.data?.stripe_subscription_id&&!billing.data.token_anchor){
      if(!process.env.STRIPE_SECRET_KEY)throw new Error("Stripe configuration required to initialize existing subscription schedules.");
      const subscription=await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.retrieve(billing.data.stripe_subscription_id);
      const start=subscription.items.data[0]?.current_period_start??subscription.start_date;
      const schedule=await admin.rpc("billing_set_token_schedule",{p_user_id:user.id,p_subscription_id:subscription.id,p_start:new Date(start*1000).toISOString()});
      if(schedule.error)throw schedule.error;
    }
    if(unique.length){
      const inserted=await admin.from("dashboard_media").upsert(unique.map(item=>({user_id:user.id,id:item.id,item})),{onConflict:"user_id,id",ignoreDuplicates:true});
      if(inserted.error)throw inserted.error;
    }
    // Never import roles, provider credentials or pending refund amounts from editable user metadata.
    const updated=await admin.auth.admin.updateUserById(user.id,{user_metadata:{...metadata,role:null,instagramConnection:null,kie_pending_task_billing:null,
      dashboard:{...metadata.dashboard,mediaLibrary:[],legacyTeamMembers:metadata.dashboard?.teamMembers??metadata.dashboard?.legacyTeamMembers??[],teamMembers:[],instagramConnection:null}}});
    if(updated.error)throw updated.error;
    // Keep the legacy index during rollout as a reversible backup. Remove it only after acceptance.
  }
}
if(apply){const result=await admin.storage.updateBucket(bucketName,{public:false});if(result.error)throw result.error;}
console.log(JSON.stringify({mode:apply?"applied":"check-only",authUsers,users,media,pendingLegacyJobs,legacyIndexesPreserved,instagramReconnectRequired:credentials,notes:"Legacy media indexes are preserved for rollback. Re-invite teams through the new acceptance flow. Existing Instagram connections require reconnection. No roles are copied from user metadata."},null,2));
