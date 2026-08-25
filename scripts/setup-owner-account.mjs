#!/usr/bin/env node
/**
 * Legt die in OWNER_EMAILS gelisteten Betreiber-Konten an bzw. hebt sie auf
 * `user_metadata.role = "owner"`. Owner haben unbegrenzte Tokens und brauchen
 * kein Stripe-Abo.
 *
 * Usage:
 *   node scripts/setup-owner-account.mjs                 # Passwort wird generiert
 *   node scripts/setup-owner-account.mjs --password "..." # Passwort selbst setzen
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
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

loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const ownerEmails = (process.env.OWNER_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("FEHLER: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein.");
  process.exit(1);
}
if (ownerEmails.length === 0) {
  console.error("FEHLER: OWNER_EMAILS ist leer. Trage z. B. OWNER_EMAILS=admin@brewai.de in .env.local ein.");
  process.exit(1);
}

const passwordArgIndex = process.argv.indexOf("--password");
const explicitPassword = passwordArgIndex > -1 ? process.argv[passwordArgIndex + 1] : null;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  // listUsers ist paginiert; fuer die erwartete Nutzerzahl reichen wenige Seiten.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers fehlgeschlagen: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

let exitCode = 0;

for (const email of ownerEmails) {
  try {
    const existing = await findUserByEmail(email);

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...existing.user_metadata, role: "owner" },
      });
      if (error) throw new Error(error.message);
      console.log(`✓ ${email}: vorhanden, Rolle auf "owner" gesetzt (id ${existing.id}).`);
      if (explicitPassword) {
        const { error: pwError } = await admin.auth.admin.updateUserById(existing.id, {
          password: explicitPassword,
        });
        if (pwError) throw new Error(pwError.message);
        console.log(`  Passwort aktualisiert.`);
      }
      continue;
    }

    const password = explicitPassword ?? randomBytes(15).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "owner" },
    });
    if (error) throw new Error(error.message);
    console.log(`✓ ${email}: neu erstellt (id ${data.user?.id}).`);
    if (!explicitPassword) {
      console.log(`  Passwort: ${password}`);
      console.log(`  Bitte jetzt notieren — es wird nicht erneut angezeigt.`);
    }
  } catch (error) {
    exitCode = 1;
    console.error(`✗ ${email}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(
  exitCode === 0
    ? "\nFertig. Login unter /admin/anmelden — 2FA via OWNER_2FA_BACKUP_CODE."
    : "\nMit Fehlern beendet.",
);
process.exit(exitCode);
