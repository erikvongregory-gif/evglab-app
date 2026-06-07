import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "redesign.template.html";
const html = readFileSync(path, "utf8");
const srcs = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map((m) => m[1]);
process.stdout.write(srcs.join("\n"));

