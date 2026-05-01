import { NextResponse } from "next/server";
import sharp from "sharp";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { enforceRateLimit, sanitizeTaskId } from "@/lib/security/requestGuards";

type DownloadFormat = "png" | "jpg" | "webp" | "svg";

function isDownloadFormat(value: string): value is DownloadFormat {
  return value === "png" || value === "jpg" || value === "webp" || value === "svg";
}

const DOWNLOAD_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 60 * 1024 * 1024; // 60 MB
const DEFAULT_ALLOWED_HOSTS = [
  "kie.ai",
  "api.kie.ai",
  "redpandaai.co",
  "kieai.redpandaai.co",
  "tempfile.aiquickdraw.com",
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

  // IPv6 local, loopback, link-local, unique local
  if (ipVersion === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd")
    );
  }

  // IPv4 private/link-local/loopback/unspecified
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function hostnameAllowed(hostname: string, allowlist: string[]): boolean {
  const normalized = hostname.toLowerCase();
  return allowlist.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

async function assertSafeSourceUrl(sourceUrl: string): Promise<URL> {
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

  if (isIP(parsed.hostname) && isPrivateOrLocalIp(parsed.hostname)) {
    throw new Error("Private Netzwerkziele sind nicht erlaubt.");
  }

  const dnsRecords = await lookup(parsed.hostname, { all: true });
  if (dnsRecords.some((entry) => isPrivateOrLocalIp(entry.address))) {
    throw new Error("Unsichere Bildquelle erkannt.");
  }

  return parsed;
}

async function readWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const body = response.body;
  if (!body) {
    throw new Error("Bildquelle konnte nicht gelesen werden.");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("Bildquelle ist zu gross.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function GET(req: Request) {
  try {
    const rateError = enforceRateLimit(req, {
      keyPrefix: "kie-download",
      limit: 20,
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
      return NextResponse.json({ error: "Bildquelle konnte nicht geladen werden." }, { status: 502 });
    }

    const sourceContentType = upstream.headers.get("content-type") || "";
    if (!sourceContentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Bildquelle ist kein Bild." }, { status: 415 });
    }

    const contentLength = Number(upstream.headers.get("content-length") || "0");
    if (contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Bildquelle ist zu gross." }, { status: 413 });
    }

    const inputBuffer = await readWithLimit(upstream, MAX_IMAGE_BYTES);
    const fileBase = `evglab-${taskId}`;

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
          "Cache-Control": "no-store",
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
    const responseBody = new Uint8Array(convertedBuffer);

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileBase}.${formatParam}"`,
        "Cache-Control": "no-store",
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
      if (message.includes("gross")) {
        return NextResponse.json({ error: "Bildquelle ist zu gross." }, { status: 413 });
      }
    }
    return NextResponse.json({ error: "Download fehlgeschlagen." }, { status: 500 });
  }
}
