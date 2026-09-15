#!/usr/bin/env node
/**
 * Legt .env.rotation.local aus der Example-Vorlage an (falls noch nicht vorhanden).
 */

import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLE = join(ROOT, ".env.rotation.local.example");
const TARGET = join(ROOT, ".env.rotation.local");

if (!existsSync(EXAMPLE)) {
  console.error("✗ .env.rotation.local.example fehlt.");
  process.exit(1);
}

if (existsSync(TARGET)) {
  console.log("· .env.rotation.local existiert bereits — nichts ueberschrieben.");
} else {
  copyFileSync(EXAMPLE, TARGET);
  console.log("✓ .env.rotation.local angelegt.");
}

console.log(`
Naechste Schritte — Werte in .env.rotation.local eintragen:

  OPENAI_ADMIN_KEY       GitHub Secret gleichen Namens ODER
                         https://platform.openai.com/settings/organization/admin-keys

  OPENAI_PROJECT_ID      GitHub Secret ODER OpenAI → Projects → BrewAI-Bild-Project

  VERCEL_TOKEN           GitHub Secret ODER https://vercel.com/account/tokens

  VERCEL_PROJECT_ID      bereits vorausgefuellt (app.brewai)

  VERCEL_DEPLOY_HOOK_URL GitHub Secret ODER Vercel → app.brewai → Settings → Git → Deploy Hooks

Optional: VERCEL_ORG_ID (Team), OPENAI_IMAGE_MODEL, ROTATION_GRACE_MINUTES

Test:
  npm run openai:rotate-image-key:dry-run
  npm run openai:rotate-image-key

Vercel braucht diese Rotator-Variablen NICHT — dort nur:
  OPENAI_IMAGE_API_KEY (+ optional OPENAI_IMAGE_SERVICE_ACCOUNT_ID nach erster Rotation)
`);
