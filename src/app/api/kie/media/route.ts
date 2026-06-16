import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { enforceRateLimit, sanitizeTaskId } from "@/lib/security/requestGuards";

const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_VIDEO_BYTES = 120 * 1024 * 1024;
const DEFAULT_ALLOWED_HOSTS = [
  "kie.ai",
  "api.kie.ai",
  "redpandaai.co",
  "kieai.redpandaai.co",
  "tempfile.redpandaai.co",
  "tempfile.aiquickdraw.com",
  "aiquickdraw.com",
];

function getAllowedHosts(): string[] {
  const fromEnv = process.env.KIE_DOWNLOAD_ALLOWED_HOSTS?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_ALLOWED_HOSTS;
}

function isPrivateOrLocalIp(ip: string): boolean {
  const ipVersion = isIP(ip);
  if (ipVersion === 0) return true;
  if (ipVersion === 6) {
    const normalized = ip.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd");
  }
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
}

function hostnameAllowed(hostname: string, allowlist: string[]): boolean {
  const normalized = hostname.toLowerCase();
  return allowlist.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

async function assertSafeSourceUrl(sourceUrl: string): Promise<URL> {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== "https:") throw new Error("Nur HTTPS-Quellen sind erlaubt.");
  if (!hostnameAllowed(parsed.hostname, getAllowedHosts())) throw new Error("Medienquelle ist nicht freigegeben.");
  if (isIP(parsed.hostname) && isPrivateOrLocalIp(parsed.hostname)) throw new Error("Private Netzwerkziele sind nicht erlaubt.");
  const dnsRecords = await lookup(parsed.hostname, { all: true });
  if (dnsRecords.some((entry) => isPrivateOrLocalIp(entry.address))) throw new Error("Unsichere Medienquelle erkannt.");
  return parsed;
}

async function readWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const body = response.body;
  if (!body) throw new Error("Medienquelle konnte nicht gelesen werden.");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) throw new Error("Medienquelle ist zu gross.");
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function GET(req: Request) {
  try {
    const authGuard = await requireAuthenticatedUser(req, "kie-media-auth");
    if (!authGuard.ok) return authGuard.response;

    const rateError = enforceRateLimit(req, {
      keyPrefix: "kie-media",
      limit: 20,
      windowMs: 60_000,
    });
    if (rateError) return rateError;

    const { searchParams } = new URL(req.url);
    const sourceUrl = z.string().trim().max(2000).catch("").parse(searchParams.get("url"));
    const taskId = sanitizeTaskId(searchParams.get("taskId") || `${Date.now()}`);
    const download = searchParams.get("download") === "1";

    const safeUrl = await assertSafeSourceUrl(sourceUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    const upstream = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return NextResponse.json({ error: "Medienquelle konnte nicht geladen werden." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const lowerType = contentType.toLowerCase();
    const allowed =
      lowerType.startsWith("video/") ||
      lowerType.startsWith("image/") ||
      lowerType.startsWith("audio/") ||
      lowerType === "application/octet-stream";
    if (!allowed) {
      return NextResponse.json({ error: "Medienquelle hat einen unerwarteten Typ." }, { status: 415 });
    }

    const contentLength = Number(upstream.headers.get("content-length") || "0");
    if (contentLength > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Medienquelle ist zu gross." }, { status: 413 });
    }

    const buffer = await readWithLimit(upstream, MAX_VIDEO_BYTES);
    const extension = lowerType.includes("mp4")
      ? "mp4"
      : lowerType.includes("webm")
        ? "webm"
        : lowerType.includes("quicktime")
          ? "mov"
          : "bin";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": download
          ? `attachment; filename="evglab-${taskId}.${extension}"`
          : `inline; filename="evglab-${taskId}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("gross")) {
      return NextResponse.json({ error: "Medienquelle ist zu gross." }, { status: 413 });
    }
    return NextResponse.json({ error: "Medienabruf fehlgeschlagen." }, { status: 500 });
  }
}
