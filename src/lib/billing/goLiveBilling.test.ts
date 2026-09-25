import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
const db = new PGlite();
const user = "00000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);");
  for (const file of ["billing-schema", "stripe-webhook-events-schema", "billing-atomic-migration", "billing-access-hardening-migration", "generation-jobs-migration", "billing-periods-migration", "generation-result-billing-migration", "go-live-security-migration", "workspaces-migration", "account-deletion-migration", "checkout-lock-migration", "webhook-recovery-migration"]) await db.exec(readFileSync(`docs/${file}.sql`, "utf8"));
  // Enterprise + planabhängiger Carry (Supabase-Migration): docs-SQL endet noch bei 30-Tage-Flat.
  await db.exec(`
    alter table public.billing_subscriptions drop constraint if exists billing_subscriptions_plan_check;
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_plan_check
      check (plan is null or plan in ('start', 'growth', 'pro', 'enterprise'));
  `);
  await db.exec(readFileSync("supabase/migrations/20260924110000_token_carry_by_plan_enterprise.sql", "utf8"));
}, 30000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("truncate auth.users cascade");
  await db.query("insert into auth.users values($1)", [user]);
  await db.query("select billing_activate_plan_atomic($1,'start',1200,'active','cus','sub',now()+interval '1 year')", [user]);
  await db.query("select billing_set_token_schedule($1,'sub',now())", [user]);
});
async function available() { return (await db.query<{ n: number }>("select monthly_tokens-used_tokens n from billing_subscriptions where user_id=$1", [user])).rows[0].n; }
async function reserve(amount: number, key: string = randomUUID()) {
  return (await db.query<{ j: { fresh: boolean; job: { id: string } } }>("select generation_reserve($1,$2,$3,'hash',$4) j", [randomUUID(),user,key,amount])).rows[0].j;
}
it("keeps billing tables and credit RPCs server-only", async () => {
  const rights = await db.query<{ anonTable: boolean; authenticatedTable: boolean; anonRpc: boolean; authenticatedRpc: boolean; serviceRpc: boolean }>(`
    select
      has_table_privilege('anon','public.billing_subscriptions','SELECT') as "anonTable",
      has_table_privilege('authenticated','public.billing_subscriptions','UPDATE') as "authenticatedTable",
      has_function_privilege('anon','public.add_monthly_tokens_atomic(uuid,integer)','EXECUTE') as "anonRpc",
      has_function_privilege('authenticated','public.add_monthly_tokens_atomic(uuid,integer)','EXECUTE') as "authenticatedRpc",
      has_function_privilege('service_role','public.add_monthly_tokens_atomic(uuid,integer)','EXECUTE') as "serviceRpc"
  `);
  expect(rights.rows[0]).toEqual({ anonTable: false, authenticatedTable: false, anonRpc: false, authenticatedRpc: false, serviceRpc: true });
});
it("reserves the last budget only once and replays the same request", async () => {
  const first = await reserve(1200, "one");
  expect((await reserve(1200,"one")).job.id).toBe(first.job.id);
  await expect(reserve(1)).rejects.toThrow();
  expect(await available()).toBe(0);
});
it("refunds a job once, including after the monthly counters reset", async () => {
  const { job } = await reserve(100);
  await db.query("update billing_subscriptions set monthly_spent=0 where user_id=$1",[user]);
  await db.query("select generation_finish($1,$2,20,'{}')",[job.id,user]);
  await db.query("select generation_finish($1,$2,0,'{}')",[job.id,user]);
  expect(await available()).toBe(1180);
});
it("stores the balance from the settlement transaction in the job result", async () => {
  await db.query("select billing_adjust_tokens_atomic($1,1100,'consume')",[user]);
  const first=(await reserve(35)).job;
  const second=(await reserve(35)).job;
  const stale=JSON.stringify({billing:{consumed:35,perVariant:35,remainingTokens:65}});
  await db.query("select generation_finish($1,$2,35,$3)",[first.id,user,stale]);
  let result=await db.query<{remaining:number}>("select (result->'billing'->>'remainingTokens')::integer remaining from generation_jobs where id=$1",[first.id]);
  expect(result.rows[0].remaining).toBe(30);
  await db.query("select billing_adjust_tokens_atomic($1,40,'add')",[user]);
  await db.query("select generation_finish($1,$2,35,$3)",[second.id,user,stale]);
  result=await db.query<{remaining:number}>("select (result->'billing'->>'remainingTokens')::integer remaining from generation_jobs where id=$1",[second.id]);
  expect(result.rows[0].remaining).toBe(70);
});
it("does not convert an expired refund into fresh tokens", async () => {
  const { job } = await reserve(100);
  await db.exec("update token_lots set expires_at=now()-interval '1 day'");
  await db.query("select generation_finish($1,$2,0,'{}')",[job.id,user]);
  expect(await available()).toBe(0);
});
it("renews annual accounts monthly and preserves unspent carry", async () => {
  await db.query("select billing_adjust_tokens_atomic($1,100,'consume')",[user]);
  await db.query("update billing_subscriptions set token_anchor=now()-interval '1 month',token_next_at=now()-interval '1 second' where user_id=$1",[user]);
  await db.query("select billing_refresh_monthly($1)",[user]);
  expect(await available()).toBe(2300);
  await db.query("select billing_refresh_monthly($1)",[user]);
  expect(await available()).toBe(2300);
});
it("does not mint repeated upgrade credits", async () => {
  for (const [plan,n] of [["growth",3000],["start",1200],["growth",3000]] as const)
    await db.query("select billing_activate_plan_atomic($1,$2,$3,'active','cus','sub',now()+interval '1 year')",[user,plan,n]);
  expect(await available()).toBe(3000);
});
it("rejects unpaid subscriptions and foreign settlements", async () => {
  const { job } = await reserve(10);
  await expect(db.query("select generation_finish($1,$2,0,'{}')",[job.id,randomUUID()])).rejects.toThrow();
  await db.exec("update billing_subscriptions set subscription_status='unpaid'");
  await expect(reserve(10)).rejects.toThrow();
});
it("enforces team seat limits and only accepts the invited email",async()=>{
  const member=randomUUID();await db.query("insert into auth.users values($1)",[member]);
  await expect(db.query("select workspace_invite($1,'member@example.com','Member','editor','hash')",[user])).rejects.toThrow("Teamplätze");
  await db.query("select billing_activate_plan_atomic($1,'growth',3000,'active','cus','sub',now()+interval '1 year')",[user]);
  await db.query("select workspace_invite($1,'member@example.com','Member','viewer','hash')",[user]);
  await expect(db.query("select workspace_accept($1,'hash','other@example.com')",[member])).rejects.toThrow();
  await db.query("select workspace_accept($1,'hash','member@example.com')",[member]);
  const rows=await db.query<{owner_id:string;role:string}>("select owner_id,role from workspace_members where user_id=$1",[member]);
  expect(rows.rows[0]).toEqual({owner_id:user,role:"viewer"});
  await expect(db.query("select workspace_accept($1,'hash','member@example.com')",[member])).rejects.toThrow();
});
it("serializes checkout creation and rejects a conflicting plan",async()=>{
  const first=await db.query<{id:string}>("select billing_claim_checkout($1,'start','yearly') id",[user]);
  const second=await db.query<{id:string}>("select billing_claim_checkout($1,'start','yearly') id",[user]);
  expect(first.rows[0].id).toBe(second.rows[0].id);
  await expect(db.query("select billing_claim_checkout($1,'pro','yearly')",[user])).rejects.toThrow();
});
it("reclaims a crashed webhook without acknowledging an in-flight event",async()=>{
  await db.exec("truncate stripe_webhook_events");
  await db.query("select stripe_claim_event('event','invoice.paid')");
  await expect(db.query("select stripe_claim_event('event','invoice.paid')")).rejects.toThrow("retry later");
  await db.exec("update stripe_webhook_events set created_at=now()-interval '11 minutes'");
  expect((await db.query<{claim:boolean}>("select stripe_claim_event('event','invoice.paid') claim")).rows[0].claim).toBe(true);
});
it.each([
  ["start", 0],
  ["growth", 30],
  ["pro", 60],
  ["enterprise", 90],
] as const)("expires %s carry after %i days", async (plan, days) => {
  await db.query("update billing_subscriptions set plan=$2,token_anchor=now()-interval '1 month',token_next_at=now()-interval '1 second' where user_id=$1", [user, plan]);
  await db.query("select billing_refresh_monthly($1)", [user]);
  const result = await db.query<{ days: number }>("select extract(epoch from (l.expires_at-b.token_next_at))/86400 as days from token_lots l join billing_subscriptions b using(user_id) where l.grant_key like 'period:%'");
  expect(Number(result.rows[0].days)).toBe(days);
});
