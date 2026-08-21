#!/usr/bin/env node
/**
 * Prüft, ob Instagram-OAuth-Env gesetzt ist (lokal oder CI).
 * Usage: node scripts/check-instagram-oauth-env.mjs
 */

const appId = process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim();
const appSecret = process.env.META_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim();
const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() || "(nicht gesetzt — Fallback im Code: https://app.brewai.de)";

console.log("Instagram OAuth — Env-Check\n");
console.log(`  NEXT_PUBLIC_APP_BASE_URL: ${baseUrl}`);
console.log(`  META_APP_ID:              ${appId ? `${appId.slice(0, 4)}… (${appId.length} Zeichen)` : "FEHLT"}`);
console.log(`  META_APP_SECRET:          ${appSecret ? "gesetzt" : "FEHLT"}`);
console.log(`  META_GRAPH_API_VERSION:   ${process.env.META_GRAPH_API_VERSION?.trim() || "v22.0 (Default)"}`);

if (baseUrl !== "(nicht gesetzt — Fallback im Code: https://app.brewai.de)") {
  try {
    const callback = new URL("/api/brand/instagram/callback", baseUrl).toString();
    console.log(`\n  Erwartete Redirect URI (Meta eintragen):\n  ${callback}`);
  } catch {
    console.log("\n  WARNUNG: NEXT_PUBLIC_APP_BASE_URL ist keine gültige URL.");
  }
}

const ok = Boolean(appId && appSecret);
console.log(ok ? "\n✓ Konfiguration vollständig (lokal/Shell-Env)." : "\n✗ META_APP_ID und META_APP_SECRET fehlen.");
process.exit(ok ? 0 : 1);
