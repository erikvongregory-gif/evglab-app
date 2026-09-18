import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { enforceRateLimit, sanitizeTaskId } from "@/lib/security/requestGuards";
import { publicFetch } from "@/lib/security/public-fetch";

type DownloadFormat = "png" | "jpg" | "webp" | "svg";

function isDownloadFormat(value: string): value is DownloadFormat {
  return value === "png" || value === "jpg" || value === "webp" || value === "svg";
}

const DOWNLOAD_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 60 * 1024 * 1024; // 60 MB
const PRIVATE_CACHE = "private, max-age=3600";
const DEFAULT_ALLOWED_HOSTS = [
  "kie.ai",
  "api.kie.ai",
  "redpandaai.co",
  "kieai.redpandaai.co",
  "tempfile.redpandaai.co",
  "tempfile.aiquickdraw.com",
];

function getAllowedHosts(): string[] {
  const fromEnv = process.env.KIE_DOWNLOAD_ALLOWED_HOSTS?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const hosts = new Set(fromEnv?.length ? fromEnv : DEFAULT_ALLOWED_HOSTS);
  // OpenAI-Pfade speichern in Supabase Storage (Custom Domain + Projekt-URL).
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
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("Ungueltige Bild-URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Nur HTTPS-Bildquellen sind erlaubt.");
  }

  const allowlist = getAllowedHosts();
  if (!hostnameAllowed(parsed.hostname, allowlist)) {
    throw new Error("Bildquelle ist nicht freigegeben.");
  }

  return parsed;
}

function sourceMatchesFormat(contentType: string, format: Exclude<DownloadFormat, "svg">): boolean {
  const type = contentType.toLowerCase();
  if (format === "png") return type.includes("png");
  if (format === "jpg") return type.includes("jpeg") || type.includes("jpg");
  return type.includes("webp");
}

export async function GET(req: Request) {
  try {
    const authGuard = await requireAuthenticatedUser(req, "kie-download-auth");
    if (!authGuard.ok) return authGuard.response;

    // Nur noch echte Downloads (Kacheln nutzen signierte Storage-URLs).
    const rateError = enforceRateLimit(req, {
      keyPrefix: "kie-download",
      limit: 60,
      windowMs: 60_000,
    });
    if (rateError) return rateError;

    const { searchParams } = new URL(req.url);
    const sourceUrl = z.string().trim().max(2000).catch("").parse(searchParams.get("url"));
    const formatParam = searchParams.get("format") || "png";
    const taskId = sanitizeTaskId(searchParams.get("taskId") || `${Date.now()}`);

    if (!isDownloadFormat(formatParam)) {
      return NextResponse.json({ error: "Ungueltiges Download-Format." }, { status: 400 });
    }

    const safeUrl = assertSafeSourceUrl(sourceUrl);
    const upstream = await publicFetch(safeUrl.toString(), {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      followRedirects: false,
      headers: { Accept: "image/*" },
    });
    if (upstream.status < 200 || upstream.status >= 300) {
      return NextResponse.json({ error: "Bildquelle konnte nicht geladen werden." }, { status: 502 });
    }

    const sourceContentType = upstream.headers["content-type"] || "";
    if (!sourceContentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Bildquelle ist kein Bild." }, { status: 415 });
    }

    const contentLength = Number(upstream.headers["content-length"] || "0");
    if (contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Bildquelle ist zu gross." }, { status: 413 });
    }

    const inputBuffer = upstream.body;
    const fileBase = `brewai-${taskId}`;

    if (formatParam === "svg") {
      const metadata = await sharp(inputBuffer).metadata();
      const width = metadata.width || 1024;
      const height = metadata.height || 1024;
      const fallbackMime = sourceContentType || "image/png";
      const encoded = inputBuffer.toString("base64");
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image href="data:${fallbackMime};base64,${encoded}" width="${width}" height="${height}" />
</svg>`;
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileBase}.svg"`,
          "Cache-Control": PRIVATE_CACHE,
        },
      });
    }

    // Schon passendes Format → Bytes durchreichen, kein erneutes sharp-Encode.
    if (sourceMatchesFormat(sourceContentType, formatParam)) {
      return new NextResponse(new Uint8Array(inputBuffer), {
        headers: {
          "Content-Type":
            formatParam === "png"
              ? "image/png"
              : formatParam === "jpg"
                ? "image/jpeg"
                : "image/webp",
          "Content-Disposition": `attachment; filename="${fileBase}.${formatParam}"`,
          "Cache-Control": PRIVATE_CACHE,
        },
      });
    }

    const convertedBuffer =
      formatParam === "png"
        ? await sharp(inputBuffer).png().toBuffer()
        : formatParam === "jpg"
          ? await sharp(inputBuffer).jpeg({ quality: 95 }).toBuffer()
          : await sharp(inputBuffer).webp({ quality: 95 }).toBuffer();

    const contentType =
      formatParam === "png" ? "image/png" : formatParam === "jpg" ? "image/jpeg" : "image/webp";

    return new NextResponse(new Uint8Array(convertedBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileBase}.${formatParam}"`,
        "Cache-Control": PRIVATE_CACHE,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("unsichere") || message.includes("nicht freigegeben") || message.includes("private")) {
        return NextResponse.json({ error: "Bildquelle ist nicht erlaubt." }, { status: 400 });
      }
      if (message.includes("https")) {
        return NextResponse.json({ error: "Nur HTTPS-Bildquellen sind erlaubt." }, { status: 400 });
      }
      if (message.includes("gross") || message.includes("groß")) {
        return NextResponse.json({ error: "Bildquelle ist zu gross." }, { status: 413 });
      }
    }
    return NextResponse.json({ error: "Download fehlgeschlagen." }, { status: 500 });
  }
}
