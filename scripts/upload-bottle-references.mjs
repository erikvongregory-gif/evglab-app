// Laedt alle Flaschen-Form-Referenzfotos aus assets/bottle-references/ in den
// Supabase-Storage-Bucket unter bottle-references/<name>.png (upsert).
//
// Nutzung (PowerShell):  node scripts/upload-bottle-references.mjs
// Liest Credentials aus .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

import { readFileSync, readdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local optional — evtl. sind die Vars schon gesetzt.
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_GENERATED_IMAGES_BUCKET?.trim() || "generated-images";

if (!url || !serviceKey) {
  console.error("Fehlt: NEXT_PUBLIC_SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dir = join(process.cwd(), "assets", "bottle-references");
const files = readdirSync(dir).filter((f) => extname(f).toLowerCase() === ".png");

if (files.length === 0) {
  console.error(`Keine .png-Dateien in ${dir} gefunden.`);
  process.exit(1);
}

let ok = 0;
for (const file of files) {
  const name = basename(file, ".png");
  const buffer = readFileSync(join(dir, file));
  const path = `bottle-references/${name}.png`;
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) {
    console.error(`FEHLER ${path}: ${error.message}`);
  } else {
    ok += 1;
    console.log(`OK ${bucket}/${path} (${buffer.length} bytes)`);
  }
}

console.log(`\nFertig: ${ok}/${files.length} Referenzfotos hochgeladen.`);
