import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    if (process.env[key] !== undefined) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[key] = v;
  }
}

loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const dryRun = process.argv.includes("--dry-run");

const { data, error } = await admin
  .from("billing_subscriptions")
  .select(
    "user_id,plan,subscription_status,stripe_subscription_id,onboarding_bonus_granted,monthly_tokens,used_tokens",
  );

if (error) {
  console.error("Select failed:", error.message);
  process.exit(1);
}

const fake = (data ?? []).filter(
  (r) =>
    !r.stripe_subscription_id &&
    r.plan &&
    ["active", "trialing"].includes(r.subscription_status),
);

console.log("project", url);
console.log("rows", data?.length ?? 0);
console.log("fake_active_no_stripe", fake.length);
for (const r of fake) {
  console.log(
    `- ${r.user_id} plan=${r.plan} status=${r.subscription_status} bonus=${r.onboarding_bonus_granted} tokens=${r.monthly_tokens}/${r.used_tokens}`,
  );
}

if (dryRun || fake.length === 0) {
  process.exit(0);
}

const ids = fake.map((r) => r.user_id);
const { data: updated, error: updateError } = await admin
  .from("billing_subscriptions")
  .update({ plan: null, subscription_status: "none" })
  .in("user_id", ids)
  .is("stripe_subscription_id", null)
  .select("user_id,plan,subscription_status");

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

console.log("cleared", updated?.length ?? 0);
