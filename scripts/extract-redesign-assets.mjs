import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { extname, join } from "node:path";

const inputPath = process.argv[2];
const outDir = process.argv[3] ?? "redesign-assets";
if (!inputPath) {
  console.error("Usage: node scripts/extract-redesign-assets.mjs <path-to-html> [outDir]");
  process.exit(1);
}

const raw = readFileSync(inputPath, "utf8");

function extractTag(type) {
  const start = `<script type="${type}">`;
  const startIdx = raw.indexOf(start);
  if (startIdx < 0) return null;
  const contentStart = startIdx + start.length;
  const endIdx = raw.indexOf("</script>", contentStart);
  if (endIdx < 0) return null;
  return raw.slice(contentStart, endIdx).trim();
}

const manifestJson = extractTag("__bundler/manifest");
if (!manifestJson) {
  console.error("Manifest tag not found");
  process.exit(1);
}

const manifest = JSON.parse(manifestJson);
mkdirSync(outDir, { recursive: true });

const saved = [];
for (const [uuid, entry] of Object.entries(manifest)) {
  const mime = entry?.mime;
  const compressed = Boolean(entry?.compressed);
  const b64 = entry?.data;
  if (typeof mime !== "string" || typeof b64 !== "string") continue;

  let buf = Buffer.from(b64, "base64");
  if (compressed) buf = gunzipSync(buf);

  let ext = "";
  if (mime.includes("javascript")) ext = ".js";
  else if (mime.includes("css")) ext = ".css";
  else if (mime.includes("html")) ext = ".html";
  else if (mime.includes("json")) ext = ".json";
  else if (mime.includes("font") || mime.includes("woff2")) ext = ".woff2";
  else if (mime.includes("svg")) ext = ".svg";
  else if (mime.includes("png")) ext = ".png";
  else if (mime.includes("jpeg") || mime.includes("jpg")) ext = ".jpg";
  else ext = extname(uuid) || "";

  const outPath = join(outDir, `${uuid}${ext}`);
  writeFileSync(outPath, buf);
  saved.push({ uuid, mime, outPath });
}

process.stdout.write(JSON.stringify({ outDir, count: saved.length }, null, 2));

