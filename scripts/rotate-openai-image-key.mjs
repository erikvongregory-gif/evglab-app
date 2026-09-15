#!/usr/bin/env node
/**
 * OpenAI Bild-Key Rotation (externer Admin-Prozess).
 *
 * Ablauf:
 *   1. Neuen Service-Account + Key im OpenAI-Project anlegen
 *   2. Smoke-Test (images/generations)
 *   3. Vercel Env OPENAI_IMAGE_API_KEY + OPENAI_IMAGE_SERVICE_ACCOUNT_ID umschalten
 *   4. Production-Redeploy ausloesen
 *   5. Grace Period abwarten
 *   6. Alten Service-Account (inkl. Key) loeschen
 *
 * Usage:
 *   node scripts/rotate-openai-image-key.mjs
 *   node scripts/rotate-openai-image-key.mjs --dry-run
 *   node scripts/rotate-openai-image-key.mjs --skip-wait --skip-delete
 *
 * Env: .env.rotation.local (empfohlen), sonst .env.local / GitHub Secrets
 * GitHub Secrets: OPENAI_ADMIN_KEY, OPENAI_PROJECT_ID, VERCEL_TOKEN, VERCEL_PROJECT_ID
 * Optional: VERCEL_ORG_ID, VERCEL_DEPLOY_HOOK_URL, ROTATION_GRACE_MINUTES (Default 20)
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const IMAGE_KEY_ENV = "OPENAI_IMAGE_API_KEY";
const SERVICE_ACCOUNT_ENV = "OPENAI_IMAGE_SERVICE_ACCOUNT_ID";
const DEFAULT_MODEL = "gpt-image-2.5-sunburst";
const DEFAULT_GRACE_MINUTES = 20;

function loadEnvFile(path, { override = false } = {}) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!override && process.env[key] !== undefined) continue;
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
  return {
    dryRun: args.includes("--dry-run"),
    skipWait: args.includes("--skip-wait"),
    skipDelete: args.includes("--skip-delete"),
  };
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function info(message) {
  console.log(`· ${message}`);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} fehlt.`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildVercelUrl(path, teamId) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId && !url.searchParams.has("teamId")) {
    url.searchParams.set("teamId", teamId);
  }
  return url.toString();
}

async function openAiAdminFetch(path, { method = "GET", body } = {}) {
  const adminKey = requireEnv("OPENAI_ADMIN_KEY");
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      payload?.error?.message ||
      payload?.message ||
      `OpenAI Admin API ${method} ${path} → HTTP ${res.status}`;
    throw new Error(detail);
  }
  return payload;
}

async function createImageServiceAccount(projectId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const payload = await openAiAdminFetch(`/organization/projects/${projectId}/service_accounts`, {
    method: "POST",
    body: {
      name: `brewai-images-${stamp}`,
    },
  });

  const apiKey = payload?.api_key?.value;
  const serviceAccountId = payload?.id;
  const keyId = payload?.api_key?.id;

  if (!apiKey || !serviceAccountId) {
    throw new Error("OpenAI lieferte keinen Service-Account oder API-Key.");
  }

  return { apiKey, serviceAccountId, keyId };
}

async function deleteServiceAccount(projectId, serviceAccountId) {
  await openAiAdminFetch(
    `/organization/projects/${projectId}/service_accounts/${serviceAccountId}`,
    { method: "DELETE" },
  );
}

async function smokeTestImageKey(apiKey, model) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: "brewai rotation smoke test — solid neutral gray square, no text",
      size: "1024x1024",
      quality: "low",
      n: 1,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      payload?.error?.message ||
      payload?.message ||
      `Smoke-Test fehlgeschlagen (HTTP ${res.status})`;
    throw new Error(detail);
  }

  const hasImage = Array.isArray(payload?.data) && payload.data.some((item) => item?.b64_json || item?.url);
  if (!hasImage) {
    throw new Error("Smoke-Test: Antwort ohne Bilddaten.");
  }
}

async function vercelFetch(path, { method = "GET", body, teamId, token }) {
  const res = await fetch(buildVercelUrl(path, teamId), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = payload?.error?.message || payload?.message || `Vercel API HTTP ${res.status}`;
    throw new Error(detail);
  }
  return payload;
}

async function listVercelEnv(projectId, token, teamId) {
  const payload = await vercelFetch(`/v9/projects/${projectId}/env`, { token, teamId });
  return payload?.envs ?? [];
}

async function upsertVercelEnv({ projectId, token, teamId, key, value, dryRun }) {
  const envs = await listVercelEnv(projectId, token, teamId);
  const productionTargets = ["production"];
  const existing = envs.find((entry) => entry.key === key && entry.target?.includes("production"));

  if (dryRun) {
    info(`[dry-run] Vercel ${existing ? "update" : "create"} ${key}`);
    return;
  }

  if (existing) {
    await vercelFetch(`/v9/projects/${projectId}/env/${existing.id}`, {
      method: "PATCH",
      token,
      teamId,
      body: {
        value,
        target: productionTargets,
        type: "encrypted",
      },
    });
    ok(`Vercel Env aktualisiert: ${key}`);
    return;
  }

  await vercelFetch(`/v10/projects/${projectId}/env`, {
    method: "POST",
    token,
    teamId,
    body: {
      key,
      value,
      target: productionTargets,
      type: "encrypted",
    },
  });
  ok(`Vercel Env angelegt: ${key}`);
}

async function readVercelEnvValue(projectId, token, teamId, key) {
  const envs = await listVercelEnv(projectId, token, teamId);
  const entry = envs.find((item) => item.key === key && item.target?.includes("production"));
  if (!entry) return null;

  const payload = await vercelFetch(`/v9/projects/${projectId}/env/${entry.id}`, {
    token,
    teamId,
  });
  return payload?.value ?? null;
}

async function triggerProductionDeploy(deployHookUrl, dryRun) {
  if (!deployHookUrl) {
    info("VERCEL_DEPLOY_HOOK_URL fehlt — bitte Production manuell redeployen.");
    return;
  }
  if (dryRun) {
    info("[dry-run] Production-Deploy Hook wuerde aufgerufen.");
    return;
  }

  const res = await fetch(deployHookUrl, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Deploy Hook fehlgeschlagen (HTTP ${res.status}).`);
  }
  ok("Production-Redeploy ausgeloest.");
}

async function main() {
  loadEnvFile(join(ROOT, ".env.local"));
  loadEnvFile(join(ROOT, ".env"));
  loadEnvFile(join(ROOT, ".env.rotation.local"), { override: true });

  const { dryRun, skipWait, skipDelete } = parseArgs(process.argv);
  const projectId = requireEnv("OPENAI_PROJECT_ID");
  const vercelToken = requireEnv("VERCEL_TOKEN");
  const vercelProjectId = requireEnv("VERCEL_PROJECT_ID");
  const vercelTeamId = process.env.VERCEL_ORG_ID?.trim() || "";
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL?.trim() || "";
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
  const graceRaw = process.env.ROTATION_GRACE_MINUTES?.trim();
  const graceMinutes = graceRaw ? Number(graceRaw) : DEFAULT_GRACE_MINUTES;

  if (!Number.isFinite(graceMinutes) || graceMinutes < 1) {
    fail("ROTATION_GRACE_MINUTES muss >= 1 sein.");
  }

  info(`Modus: ${dryRun ? "dry-run" : "live"} · Modell: ${model} · Grace: ${graceMinutes} min`);

  const previousServiceAccountId = await readVercelEnvValue(
    vercelProjectId,
    vercelToken,
    vercelTeamId,
    SERVICE_ACCOUNT_ENV,
  );
  if (previousServiceAccountId) {
    info(`Bisheriger Service-Account: ${previousServiceAccountId}`);
  } else {
    info("Kein bisheriger Service-Account in Vercel — Erstlauf oder manuelles Setup.");
  }

  info("Schritt 1/6 — Neuen Service-Account + Key anlegen …");
  let created;
  if (dryRun) {
    created = {
      apiKey: "sk-dry-run",
      serviceAccountId: "svc_acct_dry_run",
      keyId: "key_dry_run",
    };
    info("[dry-run] Wuerde OpenAI Service-Account erstellen.");
  } else {
    created = await createImageServiceAccount(projectId);
    ok(`Neuer Service-Account: ${created.serviceAccountId}`);
  }

  info("Schritt 2/6 — Smoke-Test …");
  if (dryRun) {
    info("[dry-run] Wuerde images/generations testen.");
  } else {
    await smokeTestImageKey(created.apiKey, model);
    ok("Smoke-Test erfolgreich.");
  }

  info("Schritt 3/6 — Vercel Env umschalten …");
  await upsertVercelEnv({
    projectId: vercelProjectId,
    token: vercelToken,
    teamId: vercelTeamId,
    key: IMAGE_KEY_ENV,
    value: created.apiKey,
    dryRun,
  });
  await upsertVercelEnv({
    projectId: vercelProjectId,
    token: vercelToken,
    teamId: vercelTeamId,
    key: SERVICE_ACCOUNT_ENV,
    value: created.serviceAccountId,
    dryRun,
  });

  info("Schritt 4/6 — Production-Redeploy …");
  await triggerProductionDeploy(deployHookUrl, dryRun);

  if (!previousServiceAccountId || skipDelete) {
    if (skipDelete) info("Schritt 5–6 uebersprungen (--skip-delete).");
    else info("Kein alter Service-Account zum Loeschen.");
    ok("Rotation abgeschlossen.");
    return;
  }

  info(`Schritt 5/6 — Grace Period (${graceMinutes} min) …`);
  if (skipWait) {
    info("--skip-wait gesetzt — ueberspringe Wartezeit.");
  } else if (dryRun) {
    info("[dry-run] Wuerde Grace Period abwarten.");
  } else {
    await sleep(graceMinutes * 60_000);
  }

  info("Schritt 6/6 — Alten Service-Account loeschen …");
  if (dryRun) {
    info(`[dry-run] Wuerde ${previousServiceAccountId} loeschen.`);
  } else {
    await deleteServiceAccount(projectId, previousServiceAccountId);
    ok(`Alter Service-Account geloescht: ${previousServiceAccountId}`);
  }

  ok("Rotation abgeschlossen.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
