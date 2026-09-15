import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { enforceRateLimit, sanitizeTaskId } from "@/lib/security/requestGuards";
import { publicFetch } from "@/lib/security/public-fetch";

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
  const hosts = new Set(fromEnv?.length ? fromEnv : DEFAULT_ALLOWED_HOSTS);
  hosts.add("auth.brewai.de");
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (supabaseUrl) hosts.add(new URL(supabaseUrl).hostname.toLowerCase());
  } catch {
    // ignore invalid env URL
  }
  return [...hosts];
}

function hostnameAllowed(hostname: string, allowlist: string[]): boolean {
  const normalized = hostname.toLowerCase();
  return allowlist.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

function assertSafeSourceUrl(sourceUrl: string): URL {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== "https:") throw new Error("Nur HTTPS-Quellen sind erlaubt.");
  if (!hostnameAllowed(parsed.hostname, getAllowedHosts())) throw new Error("Medienquelle ist nicht freigegeben.");
  return parsed;
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

    const safeUrl = assertSafeSourceUrl(sourceUrl);
    const upstream = await publicFetch(safeUrl.toString(), {
      maxBytes: MAX_VIDEO_BYTES,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      followRedirects: false,
      headers: { Accept: "video/*,image/*,audio/*,application/octet-stream" },
    });

    if (upstream.status < 200 || upstream.status >= 300) {
      return NextResponse.json({ error: "Medienquelle konnte nicht geladen werden." }, { status: 502 });
    }

    const contentType = upstream.headers["content-type"] || "application/octet-stream";
    const lowerType = contentType.toLowerCase();
    const allowed =
      lowerType.startsWith("video/") ||
      lowerType.startsWith("image/") ||
      lowerType.startsWith("audio/") ||
      lowerType === "application/octet-stream";
    if (!allowed) {
      return NextResponse.json({ error: "Medienquelle hat einen unerwarteten Typ." }, { status: 415 });
    }

    const contentLength = Number(upstream.headers["content-length"] || "0");
    if (contentLength > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Medienquelle ist zu gross." }, { status: 413 });
    }

    const buffer = upstream.body;
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
          ? `attachment; filename="brewai-${taskId}.${extension}"`
          : `inline; filename="brewai-${taskId}.${extension}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && /gro(ss|ß)/.test(error.message.toLowerCase())) {
      return NextResponse.json({ error: "Medienquelle ist zu gross." }, { status: 413 });
    }
    return NextResponse.json({ error: "Medienabruf fehlgeschlagen." }, { status: 500 });
  }
}
