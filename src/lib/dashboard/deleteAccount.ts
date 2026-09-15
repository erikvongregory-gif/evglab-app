import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/billing/stripeServer";

/** Re-entrant: leave Auth and billing intact until all external cleanup succeeds. */
export async function deleteAccount(userId: string) {
  const admin = createAdminClient();
  const billing = await admin.from("billing_subscriptions").select("stripe_subscription_id,stripe_customer_id").eq("user_id",userId).maybeSingle();
  if(billing.error)throw new Error("Abrechnung konnte nicht geprüft werden.");
  const begin = await admin.from("account_deletion_jobs").upsert({user_id:userId},{onConflict:"user_id",ignoreDuplicates:true});
  if(begin.error)throw new Error("Löschauftrag konnte nicht gespeichert werden.");
  try {
    const pending=await admin.from("generation_jobs").select("id").eq("user_id",userId).in("status",["reserved","needs_review"]).limit(1);
    if(pending.error)throw new Error("Aufträge konnten nicht geprüft werden.");
    if(pending.data?.length)throw new Error("Bitte laufende Aufträge abschließen lassen. Der Löschauftrag bleibt gespeichert.");
    if(billing.data?.stripe_customer_id || billing.data?.stripe_subscription_id) {
      const stripe=getStripeClient(); // Missing configuration is an error, never silently skip cancellation.
      if(billing.data.stripe_customer_id) {
        for await(const subscription of stripe.subscriptions.list({customer:billing.data.stripe_customer_id,status:"all",limit:100}))
          if(!["canceled","incomplete_expired"].includes(subscription.status))await stripe.subscriptions.cancel(subscription.id);
      } else if(billing.data.stripe_subscription_id) {
        const subscription=await stripe.subscriptions.retrieve(billing.data.stripe_subscription_id);
        if(!["canceled","incomplete_expired"].includes(subscription.status))await stripe.subscriptions.cancel(subscription.id);
      }
    }
    const bucket=admin.storage.from(process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim()||"generated-images");
    for(const folder of ["generated","beer-labels","brand-fonts"]) {
      const prefix=`${folder}/${userId}`;
      for(;;) {
        const listing=await bucket.list(prefix,{limit:100});
        if(listing.error)throw new Error("Mediendateien konnten nicht aufgelistet werden.");
        if(!listing.data.length)break;
        const paths=listing.data.map(item=>`${prefix}/${item.name}`);
        const removed=await bucket.remove(paths);
        if(removed.error)throw new Error("Mediendateien konnten nicht gelöscht werden.");
      }
    }
    const legacy=await bucket.remove([`media-library/${userId}.json`]);
    if(legacy.error)throw new Error("Alter Medienindex konnte nicht gelöscht werden.");
    // Database-owned personal resources cascade; Stripe invoices remain in Stripe for retention.
    const deleted=await admin.auth.admin.deleteUser(userId);
    if(deleted.error)throw new Error("Konto konnte nicht gelöscht werden. Löschung kann fortgesetzt werden.");
  } catch(error) {
    await admin.from("account_deletion_jobs").update({last_error:error instanceof Error?error.message:"Löschung fehlgeschlagen"}).eq("user_id",userId);
    throw error;
  }
}
