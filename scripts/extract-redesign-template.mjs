import { readFileSync } from "node:fs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/extract-redesign-template.mjs <path-to-html>");
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

const templateJson = extractTag("__bundler/template");
if (!templateJson) {
  console.error("Template tag not found");
  process.exit(1);
}

const template = JSON.parse(templateJson);
process.stdout.write(template);

