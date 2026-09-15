#!/usr/bin/env node
/**
 * Preflight, Stripe-Webhook und koordinierter Rollout fuer billing-atomic-migration.sql.
 *
 * Usage:
 *   node scripts/billing-atomic-rollout.mjs preflight
 *   node scripts/billing-atomic-rollout.mjs sync-stripe-webhook
 *   node scripts/billing-atomic-rollout.mjs sync-stripe-webhook --live
 *   node scripts/billing-atomic-rollout.mjs apply-migration --confirm
 *
 * Migration erfordert SUPABASE_DB_URL (postgres://...) oder DATABASE_URL.
 * Ohne DB-URL: SQL manuell im Supabase SQL Editor aus docs/billing-atomic-migration.sql.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOCS = join(ROOT, "docs");

const REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
];

const ATOMIC_RPC = "billing_adjust_tokens_atomic";
const ATOMIC_COLUMNS = [
  "monthly_allowance",
  "monthly_spent",
  "purchased_balance",
  "purchased_spent",
  "last_token_period_end",
  "onboarding_bonus_granted",
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.find((a) => !a.startsWith("-")) ?? "preflight";
  return {
    command,
    live: args.includes("--live"),
    confirm: args.includes("--confirm"),
    dryRun: args.includes("--dry-run"),
  };
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.warn(`! ${message}`);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local setzen.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function checkTables(admin) {
  const tables = ["billing_subscriptions", "stripe_webhook_events", "billing_token_pack_grants"];
  const out = {};
  for (const table of tables) {
    const { error, count } = await admin.from(table).select("*", { count: "exact", head: true });
    out[table] = error ? { ok: false, error: error.message } : { ok: true, rows: count ?? 0 };
  }
  return out;
}

async function checkAtomicMigration(admin) {
  const colProbe = await admin
    .from("billing_subscriptions")
    .select(ATOMIC_COLUMNS.join(","))
    .limit(1);
  const columnsReady = !colProbe.error;

  const rpcProbe = await admin.rpc(ATOMIC_RPC, {
    p_user_id: "00000000-0000-0000-0000-000000000001",
    p_amount: 1,
    p_operation: "consume",
  });
  const rpcReady = rpcProbe.error?.code !== "PGRST202";

  return { columnsReady, rpcReady, rpcError: rpcProbe.error?.message };
}

async function checkStuckWebhooks(admin) {
  const { data, error } = await admin
    .from("stripe_webhook_events")
    .select("event_id,event_type,status,created_at")
    .eq("status", "processing")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { error: error.message, count: 0, rows: [] };
  return { count: data?.length ?? 0, rows: data ?? [] };
}

async function auditHistoricalGrants(admin) {
  const { data: grants, error } = await admin
    .from("billing_token_pack_grants")
    .select("session_id,user_id,tokens,source,granted_at")
    .order("granted_at", { ascending: false })
    .limit(200);
  if (error) return { error: error.message };

  const byUser = new Map();
  for (const row of grants ?? []) {
    const entry = byUser.get(row.user_id) ?? { claims: 0, tokens: 0 };
    entry.claims += 1;
    entry.tokens += row.tokens;
    byUser.set(row.user_id, entry);
  }

  const { data: balances } = await admin
    .from("billing_subscriptions")
    .select("user_id,plan,monthly_tokens,used_tokens")
    .order("updated_at", { ascending: false });

  const suspicious = [];
  for (const row of balances ?? []) {
    const grant = byUser.get(row.user_id);
    if (!grant) continue;
    const visibleRemaining = Math.max(row.monthly_tokens - row.used_tokens, 0);
    if (grant.tokens > 0 && visibleRemaining > grant.tokens + 500) {
      suspicious.push({
        user_id: row.user_id,
        plan: row.plan,
        visibleRemaining,
        claimedPackTokens: grant.tokens,
        claims: grant.claims,
      });
    }
  }

  return {
    grantRows: grants?.length ?? 0,
    usersWithClaims: byUser.size,
    suspiciousCount: suspicious.length,
    suspicious: suspicious.slice(0, 10),
  };
}

function stripeClient(live) {
  const testKey = process.env.STRIPE_SECRET_KEY?.trim();
  const liveKey = process.env.STRIPE_LIVE_SECRET_KEY?.trim();
  const key = live ? liveKey ?? (testKey?.startsWith("sk_live_") ? testKey : null) : testKey;
  if (!key) {
    throw new Error(live ? "STRIPE_LIVE_SECRET_KEY oder sk_live_ in STRIPE_SECRET_KEY setzen." : "STRIPE_SECRET_KEY fehlt.");
  }
  return new Stripe(key);
}

async function syncStripeWebhook({ live, dryRun }) {
  const stripe = stripeClient(live);
  const mode = live ? "live" : "test";
  const appBase = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() || "https://app.brewai.de";
  const targetUrl = appBase.includes("localhost") ? "https://app.brewai.de/api/stripe/webhook" : `${appBase.replace(/\/$/, "")}/api/stripe/webhook`;

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const matches = endpoints.data.filter((ep) => ep.url === targetUrl || ep.url.includes("/api/stripe/webhook"));

  if (matches.length === 0) {
    warn(`Kein Stripe-${mode}-Webhook fuer ${targetUrl} gefunden.`);
    if (dryRun) return;
    const created = await stripe.webhookEndpoints.create({
      url: targetUrl,
      enabled_events: REQUIRED_WEBHOOK_EVENTS,
      description: "BrewAI billing (atomic rollout)",
    });
    ok(`Webhook angelegt (${mode}): ${created.id}`);
    warn(`Neues Signing Secret in STRIPE_WEBHOOK_SECRET / Vercel hinterlegen: whsec_…`);
    return;
  }

  for (const ep of matches) {
    const missing = REQUIRED_WEBHOOK_EVENTS.filter(
      (event) => !ep.enabled_events.includes(event) && !ep.enabled_events.includes("*"),
    );
    if (missing.length === 0) {
      ok(`Webhook ${ep.id} (${mode}) ist vollstaendig.`);
      continue;
    }
    warn(`Webhook ${ep.id} (${mode}) fehlt: ${missing.join(", ")}`);
    if (dryRun) continue;
    const events = [...new Set([...ep.enabled_events, ...missing])];
    await stripe.webhookEndpoints.update(ep.id, { enabled_events: events });
    ok(`Webhook ${ep.id} (${mode}) aktualisiert.`);
  }
}

async function applyMigration({ confirm, dryRun }) {
  if (!confirm && !dryRun) {
    fail("Migration nur mit --confirm (oder Probe mit --dry-run). Waehrend der Umstellung Billing-Traffic pausieren.");
  }

  const dbUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  const sqlPath = join(DOCS, "billing-atomic-migration.sql");
  if (!existsSync(sqlPath)) fail(`${sqlPath} fehlt.`);

  const sql = readFileSync(sqlPath, "utf8");
  if (dryRun) {
    ok(`Migration bereit (${sql.length} Zeichen). Basis: billing-schema.sql + stripe-webhook-events-schema.sql`);
    if (!dbUrl) warn("SUPABASE_DB_URL nicht gesetzt — manuell im Supabase SQL Editor ausfuehren.");
    return;
  }
  if (!dbUrl) {
    fail("SUPABASE_DB_URL oder DATABASE_URL fuer apply-migration setzen, sonst SQL Editor verwenden.");
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    fail("Paket 'pg' fehlt. Entweder npm install pg --save-dev oder SQL im Supabase SQL Editor ausfuehren.");
  }

  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    warn("Starte billing-atomic-migration.sql — Billing-Schreibzugriffe muessen pausiert sein.");
    await client.query(sql);
    ok("Migration erfolgreich angewendet.");
  } finally {
    await client.end();
  }
}

async function preflight() {
  console.log("\n=== Billing Atomic Preflight ===\n");
  const admin = adminClient();

  const tables = await checkTables(admin);
  for (const [table, info] of Object.entries(tables)) {
    if (info.ok) ok(`${table}: ${info.rows} Zeilen`);
    else fail(`${table}: ${info.error}`);
  }

  const atomic = await checkAtomicMigration(admin);
  if (atomic.columnsReady && atomic.rpcReady) {
    ok("Atomare Migration bereits angewendet.");
  } else {
    warn("Atomare Migration fehlt noch (Spalten/RPC). Vor App-Deploy ausrollen.");
    if (!atomic.columnsReady) warn(`Spalten ${ATOMIC_COLUMNS.join(", ")} fehlen.`);
    if (!atomic.rpcReady) warn(`${ATOMIC_RPC} nicht verfuegbar.`);
  }

  const stuck = await checkStuckWebhooks(admin);
  if (stuck.error) warn(`stripe_webhook_events: ${stuck.error}`);
  else if (stuck.count === 0) ok("Keine haengenden processing-Webhook-Events.");
  else warn(`${stuck.count} processing-Events — vor Go-Live pruefen.`);

  const audit = await auditHistoricalGrants(admin);
  if (audit.error) warn(`Grant-Audit: ${audit.error}`);
  else {
    ok(`Token-Pack-Claims: ${audit.grantRows} Eintraege, ${audit.usersWithClaims} Nutzer.`);
    if (audit.suspiciousCount > 0) {
      warn(`${audit.suspiciousCount} Nutzer mit moeglichem historischem Ueberbestand — manuell abstimmen (siehe Rollout-Doku).`);
      console.log(JSON.stringify(audit.suspicious, null, 2));
    }
  }

  console.log("\n--- Stripe Webhook (Test) ---");
  await syncStripeWebhook({ live: false, dryRun: true });
  console.log("\n--- Stripe Webhook (Live) ---");
  try {
    await syncStripeWebhook({ live: true, dryRun: true });
  } catch (error) {
    warn(String(error.message ?? error));
    warn("Vor Go-Live: npm run billing:sync-webhook:live mit STRIPE_LIVE_SECRET_KEY.");
  }

  console.log("\n=== Go-Live Kurzablauf ===");
  console.log("1. Backup + Billing/Checkout/Webhooks pausieren");
  console.log("2. docs/billing-atomic-migration.sql auf Prod ausfuehren");
  console.log("3. App mit atomarem Billing-Stand deployen (kein Rollback ohne DB-Restore)");
  console.log("4. Stripe Live-Webhook pruefen (async_payment_succeeded)");
  console.log("5. Smoke-Tests gemaess docs/billing-atomic-rollout.md\n");
}

async function main() {
  loadEnvFile(join(ROOT, ".env.local"));
  loadEnvFile(join(ROOT, ".env"));

  const args = parseArgs(process.argv);
  switch (args.command) {
    case "preflight":
      await preflight();
      break;
    case "sync-stripe-webhook":
      await syncStripeWebhook({ live: args.live, dryRun: args.dryRun });
      break;
    case "apply-migration":
      await applyMigration({ confirm: args.confirm, dryRun: args.dryRun });
      break;
    default:
      fail(`Unbekannter Befehl: ${args.command}. Nutze preflight | sync-stripe-webhook | apply-migration`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
