import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

const bodySchema = z.object({
  instagramUrl: z.string().url().max(1200),
});

function deriveBrandName(instagramUrl: string): string {
  try {
    const parsed = new URL(instagramUrl);
    const parts = parsed.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    const handle = (parts[0] ?? "").replace(/^@/, "");
    if (!handle) return "";
    const normalized = handle.replace(/[._-]+/g, " ").trim();
    return normalized
      .split(" ")
      .filter(Boolean)
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

function deriveInstagramUsername(instagramUrl: string): string {
  try {
    const parsed = new URL(instagramUrl);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "instagram.com") return "";
    const firstSegment = parsed.pathname.split("/").map((part) => part.trim()).filter(Boolean)[0] ?? "";
    const cleaned = firstSegment.replace(/^@/, "").trim().toLowerCase();
    if (!cleaned || ["p", "reel", "stories", "explore"].includes(cleaned)) return "";
    return cleaned;
  } catch {
    return "";
  }
}

type InstagramDiscoveryMediaItem = {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

async function fetchInstagramReferenceImages(username: string): Promise<string[]> {
  const accessToken = process.env.INSTAGRAM_GRAPH_API_TOKEN?.trim();
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  if (!accessToken || !businessAccountId || !username) return [];

  const discoveryField = `business_discovery.username(${username}){media.limit(6){media_type,media_url,thumbnail_url}}`;
  const url = new URL(`https://graph.facebook.com/v22.0/${businessAccountId}`);
  url.searchParams.set("fields", discoveryField);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    business_discovery?: { media?: { data?: InstagramDiscoveryMediaItem[] } };
  };

  const mediaItems = payload.business_discovery?.media?.data ?? [];
  return mediaItems
    .map((item) => {
      const type = String(item.media_type ?? "").toUpperCase();
      if (type === "VIDEO") return item.thumbnail_url?.trim() ?? "";
      return item.media_url?.trim() ?? item.thumbnail_url?.trim() ?? "";
    })
    .filter(Boolean)
    .slice(0, 5);
}

export async function POST(req: Request) {
  const rateError = await enforceRateLimitPersistent(req, {
    keyPrefix: "brand-instagram-intake",
    limit: 20,
    windowMs: 60_000,
  });
  if (rateError) return rateError;
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltiger Instagram-Link." }, { status: 400 });
  }

  const brandName = deriveBrandName(parsed.data.instagramUrl);
  const username = deriveInstagramUsername(parsed.data.instagramUrl);
  const referenceImageUrls = await fetchInstagramReferenceImages(username);

  return NextResponse.json({
    ok: true,
    suggestion: {
      breweryName: brandName,
      visualDna:
        "Authentische Produktfotografie mit realistischer Textur, markante Etikett-/Typografie-Praesenz im Bild",
      mustKeep:
        "Logo und Wortmarke unveraendert halten, Etikettgeometrie und Farbaufteilung konsistent halten",
      mustAvoid:
        "Falsche Markenfarben oder fremde Farbwelt, unleserliche oder verformte Labels",
      referenceImageUrls,
    },
  });
}
