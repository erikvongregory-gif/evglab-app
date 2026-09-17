import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { chromium } from "playwright";
import fs from "fs";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const ERIK = "0217b8e7-5d16-48c9-b0a3-d14bd3a9c6f6";
const ADMIN_MEDIA_USER = "43a164b3-8b98-4acc-ba87-09401c04a58a";

function getSecret() {
  const configured = process.env.ADMIN_2FA_SECRET || process.env.NEXTAUTH_SECRET;
  if (!configured || configured.trim().length < 32) throw new Error("secret missing");
  return configured;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encodeSigned(payload) {
  const raw = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${raw}.${sign(raw)}`;
}

function buildTrustedDeviceToken(userId, passwordEpoch = 0) {
  return encodeSigned({
    userId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    passwordEpoch,
  });
}

function buildVerifiedToken(userId) {
  return encodeSigned({
    userId,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  });
}

function buildUsageDays(days = 90) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const tokens = weekend ? Math.floor(Math.random() * 40) : 20 + Math.floor(Math.random() * 120);
    out.push({ date: iso, tokens: i % 7 === 3 ? tokens + 80 : tokens });
  }
  return out;
}

const email = "erikvongre@gmail.com";
const tempPass = `BrewShot-${crypto.randomBytes(6).toString("hex")}!`;
const tempIds = [];

async function restoreBilling() {
  await admin
    .from("billing_subscriptions")
    .update({
      plan: "start",
      monthly_tokens: 300,
      used_tokens: 35,
      monthly_allowance: 300,
      monthly_spent: 35,
      subscription_status: "active",
      current_period_end: null,
      token_period_granted: 300,
    })
    .eq("user_id", ERIK);
}

async function cleanupTempMedia() {
  for (const id of tempIds) {
    await admin.from("dashboard_media").delete().eq("user_id", ERIK).eq("id", id);
  }
}

try {
  const { data: userData } = await admin.auth.admin.getUserById(ERIK);
  const epochRaw = userData.user?.user_metadata?.password_epoch;
  const passwordEpoch =
    typeof epochRaw === "number"
      ? epochRaw
      : typeof epochRaw === "string" && /^\d+$/.test(epochRaw)
        ? Number(epochRaw)
        : 0;

  const trusted = buildTrustedDeviceToken(ERIK, passwordEpoch);
  const verified = buildVerifiedToken(ERIK);

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 27);

  await admin.auth.admin.updateUserById(ERIK, { password: tempPass });
  await admin
    .from("billing_subscriptions")
    .update({
      plan: "pro",
      monthly_tokens: 7500,
      used_tokens: 1680,
      monthly_allowance: 7500,
      monthly_spent: 1680,
      subscription_status: "active",
      current_period_end: periodEnd.toISOString(),
      token_period_granted: 7500,
    })
    .eq("user_id", ERIK);

  const { data: adminMedia } = await admin
    .from("dashboard_media")
    .select("*")
    .eq("user_id", ADMIN_MEDIA_USER)
    .limit(8);

  for (const row of adminMedia ?? []) {
    const id = crypto.randomUUID();
    tempIds.push(id);
    await admin.from("dashboard_media").upsert({ user_id: ERIK, id, item: row.item });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: "http://localhost:3001",
  });

  await context.addCookies([
    {
      name: "evglab_2fa_device",
      value: trusted,
      url: "http://localhost:3001/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "evglab_admin_2fa_verified",
      value: verified,
      url: "http://localhost:3001/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  // LinkedIn-Zahlen: echte UI, Pro-Summary klar lesbar
  await page.route("**/api/dashboard/summary", async (route) => {
    const period = periodEnd.toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          unlimited: false,
          tokens: {
            monthly: 7500,
            used: 1680,
            remaining: 5820,
            unlimited: false,
          },
          periodEnd: period,
          postsThisMonth: 47,
          chargesTotal: 128,
          teamMembers: 3,
          openInvites: 1,
          billingStatus: "active",
          plan: "pro",
          degradedBilling: false,
          degradedUsage: false,
          tokenUsageByDay: buildUsageDays(90),
        },
        activities: [],
      }),
    });
  });

  await context.request.post("/auth/signin", {
    form: { email, password: tempPass, next: "/dashboard" },
    headers: {
      Origin: "http://localhost:3001",
      Referer: "http://localhost:3001/anmelden",
    },
    maxRedirects: 10,
  });

  await context.addCookies([
    {
      name: "evglab_2fa_device",
      value: trusted,
      url: "http://localhost:3001/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "evglab_admin_2fa_verified",
      value: verified,
      url: "http://localhost:3001/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/dashboard", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("text=Brauerei Pro", { timeout: 30000 });
  await page.waitForTimeout(2500);

  // Persönliche Mail für LinkedIn-Post ausblenden
  await page.evaluate(() => {
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("@")) {
        node.textContent = node.textContent.replace(/[\w.+-]+@[\w.-]+\.\w+/g, "studio@brewai.de");
      }
      node.childNodes?.forEach(walk);
    };
    walk(document.body);
  });

  console.log("url", page.url());
  const body = (await page.locator("body").innerText()).slice(0, 900).replace(/\n/g, " | ");
  console.log("body", body);

  fs.mkdirSync("docs/visual-qa", { recursive: true });
  fs.mkdirSync("assets", { recursive: true });
  await page.screenshot({ path: "docs/visual-qa/linkedin-real-dashboard.png", fullPage: false });
  await page.screenshot({ path: "assets/brewai-dashboard-linkedin-pro.png", fullPage: false });
  console.log("saved");

  await browser.close();
} finally {
  await cleanupTempMedia();
  await restoreBilling();
  console.log("cleaned up");
}
