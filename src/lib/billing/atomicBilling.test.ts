import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Executes the production SQL against embedded PostgreSQL, without credentials.
// PGlite queues connections: this tests atomic statements and rollback, not multi-process locking.
const db = new PGlite();
const user = "00000000-0000-0000-0000-000000000001";
const migration = readFileSync("docs/billing-atomic-migration.sql", "utf8");
async function balance() {
  return (await db.query<Record<string, number>>("select * from billing_subscriptions where user_id = $1", [user])).rows[0];
}
async function adjust(amount: number, operation = "consume") {
  return db.query("select * from billing_adjust_tokens_atomic($1, $2, $3)", [user, amount, operation]);
}
async function grant(id = "cs_one", target = user) {
  return (await db.query<{ granted: boolean }>("select billing_grant_token_pack_atomic($1,$2,'pack',100,'webhook') as granted", [id, target])).rows[0].granted;
}
async function activate(plan = "start", amount = 1200) {
  await db.query("select billing_activate_plan_atomic($1,$2,$3,'active','cus_one','sub_one','2026-09-01')", [user, plan, amount]);
}
async function renew(end = "2026-10-01") {
  await db.query("select billing_renew_period_atomic('sub_one',$1)", [end]);
}

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
  await db.exec(readFileSync("docs/billing-schema.sql", "utf8"));
  await db.exec(readFileSync("docs/stripe-webhook-events-schema.sql", "utf8"));
  await db.exec(migration);
}, 30_000);
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("truncate billing_token_pack_grants, billing_subscriptions, auth.users cascade;");
  await db.query("insert into auth.users values ($1)", [user]);
  await activate();
});

describe("atomic token accounting (PostgreSQL)", () => {
  it("charges both concurrent requests without lost updates", async () => {
    await Promise.all([adjust(10), adjust(10)]);
    expect((await balance()).used_tokens).toBe(20);
  });
  it("only one request can spend the last tokens", async () => {
    await adjust(1190);
    const results = await Promise.allSettled([adjust(10), adjust(10)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await balance()).used_tokens).toBe(1200);
  });
  it("refund and consume preserve both bookings", async () => {
    await adjust(100);
    await Promise.all([adjust(30, "refund"), adjust(20)]);
    expect((await balance()).used_tokens).toBe(90);
  });
  it("never replenishes a fully spent pack on renewal or sync", async () => {
    await grant(); await adjust(1300); await renew(); await activate();
    const b = await balance();
    expect(b.monthly_tokens - b.used_tokens).toBe(1200);
    expect(b.purchased_balance).toBe(0);
  });
  it("carries only unspent purchased tokens into the next month", async () => {
    await grant(); await adjust(1250); await renew();
    expect((await balance()).monthly_tokens).toBe(1250);
    await adjust(20); await renew(); await renew("2026-09-01");
    expect((await balance()).used_tokens).toBe(20);
  });
  it("refund restores purchased tokens after exhausting monthly tokens", async () => {
    await grant(); await adjust(1250); await adjust(30, "refund");
    expect((await balance()).purchased_balance).toBe(80);
    await renew(); expect((await balance()).monthly_tokens).toBe(1280);
  });
  it("plan downgrade/upgrade does not erase consumption or revive purchased tokens", async () => {
    await activate("growth", 3000); await grant(); await adjust(3050);
    await activate("start", 1200);
    let b = await balance(); expect(b.monthly_tokens - b.used_tokens).toBe(50);
    await activate("growth", 3000);
    b = await balance(); expect(b.monthly_tokens - b.used_tokens).toBe(50);
  });
  it("cancellation preserves remaining bought tokens and blocks consumption", async () => {
    await grant(); await adjust(1250);
    await db.exec("select billing_cancel_subscription_atomic('sub_one','2026-09-01')");
    expect((await balance()).purchased_balance).toBe(50);
    await expect(adjust(1)).rejects.toThrow("Kein aktives Abo");
  });
  it("duplicate checkout requests credit exactly once", async () => {
    expect(await Promise.all([grant(), grant()])).toEqual([true, false]);
    expect((await balance()).purchased_balance).toBe(100);
  });
  it("rolls back the claim when crediting fails, so a retry succeeds", async () => {
    await db.exec("create function fail_credit() returns trigger language plpgsql as $$ begin raise exception 'simulated failure'; end $$; create trigger fail_credit before update on billing_subscriptions for each row execute function fail_credit();");
    await expect(grant()).rejects.toThrow("simulated failure");
    expect((await db.query("select * from billing_token_pack_grants")).rows).toHaveLength(0);
    await db.exec("drop trigger fail_credit on billing_subscriptions; drop function fail_credit();");
    expect(await grant()).toBe(true);
    expect((await balance()).purchased_balance).toBe(100);
  });
  it("rejects mismatched duplicate grants and invalid debits", async () => {
    await grant();
    await expect(grant("cs_one", "00000000-0000-0000-0000-000000000002")).rejects.toThrow("mismatch");
    await expect(adjust(-1)).rejects.toThrow("Amount must be positive");
    expect((await balance()).purchased_balance).toBe(100);
  });
  it("rejects old read/modify/write callers after migration", async () => {
    await expect(db.exec("update billing_subscriptions set used_tokens = 10")).rejects.toThrow("Legacy balance writes");
    expect((await balance()).used_tokens).toBe(0);
  });
  it("does not reset balances when migration is rerun", async () => {
    await grant(); await adjust(1250); await db.exec(migration);
    expect((await balance()).purchased_balance).toBe(50);
    expect((await balance()).used_tokens).toBe(1250);
  });
  it("denies RPC calls to browser roles", async () => {
    await db.exec("set role authenticated");
    try { await expect(grant()).rejects.toThrow("permission denied"); }
    finally { await db.exec("reset role"); }
  });
  it("backfills a legacy balance without recreating spent extras", async () => {
    const legacy = new PGlite();
    try {
      await legacy.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
      await legacy.exec(readFileSync("docs/billing-schema.sql", "utf8"));
      await legacy.exec(readFileSync("docs/stripe-webhook-events-schema.sql", "utf8"));
      await legacy.query("insert into auth.users values ($1)", [user]);
      await legacy.query("insert into billing_subscriptions(user_id,plan,monthly_tokens,used_tokens,subscription_status) values ($1,'start',1700,1400,'active')", [user]);
      await legacy.exec(migration);
      const b = (await legacy.query<Record<string, number>>("select * from billing_subscriptions")).rows[0];
      expect(b.monthly_allowance).toBe(1200);
      expect(b.purchased_balance).toBe(300);
      expect(b.purchased_spent).toBe(200);
      expect(b.monthly_tokens - b.used_tokens).toBe(300);
    } finally { await legacy.close(); }
  });
});
