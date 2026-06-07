import {
  buildInstagramRedirectUri,
  getMetaAppId,
  getMetaAppSecret,
  graphApiUrl,
} from "@/lib/brand/instagram-config";
import type { StoredInstagramConnection } from "@/lib/brand/instagram-connection-store";

type GraphErrorPayload = {
  error?: { message?: string; type?: string; code?: number };
};

type TokenExchangeResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type AccountsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id?: string };
  }>;
};

type IgProfileResponse = {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

export type InstagramMediaItem = {
  id: string;
  mediaType: string;
  mediaUrl: string;
  caption: string;
  timestamp: string;
};

const DOWNLOAD_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function parseGraphError(payload: unknown, fallback: string): string {
  const record = payload as GraphErrorPayload;
  return record.error?.message?.trim() || fallback;
}

async function graphFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as T & GraphErrorPayload;
  if (!response.ok) {
    throw new Error(parseGraphError(payload, `Instagram Graph API Fehler (${response.status}).`));
  }
  if ((payload as GraphErrorPayload).error) {
    throw new Error(parseGraphError(payload, "Instagram Graph API Fehler."));
  }
  return payload;
}

export function buildInstagramOAuthUrl(params: { appOrigin: string; state: string }): string {
  const appId = getMetaAppId();
  if (!appId) throw new Error("META_APP_ID fehlt.");

  const url = new URL(`https://www.facebook.com/${process.env.META_GRAPH_API_VERSION?.trim() || "v22.0"}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", buildInstagramRedirectUri(params.appOrigin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_basic,pages_show_list,pages_read_engagement");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeCodeForUserAccessToken(params: {
  appOrigin: string;
  code: string;
}): Promise<{ accessToken: string; expiresIn?: number }> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  if (!appId || !appSecret) throw new Error("Meta App ID/Secret fehlt.");

  const shortLivedUrl = graphApiUrl("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: buildInstagramRedirectUri(params.appOrigin),
    code: params.code,
  });

  const shortLived = await graphFetch<TokenExchangeResponse>(shortLivedUrl);
  if (!shortLived.access_token) throw new Error("Kein Instagram-Zugriffstoken erhalten.");

  const longLivedUrl = graphApiUrl("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  });
  const longLived = await graphFetch<TokenExchangeResponse>(longLivedUrl);
  if (!longLived.access_token) throw new Error("Long-lived Token konnte nicht erstellt werden.");

  return {
    accessToken: longLived.access_token,
    expiresIn: longLived.expires_in ?? shortLived.expires_in,
  };
}

export async function resolveInstagramBusinessConnection(userAccessToken: string): Promise<StoredInstagramConnection> {
  const accountsUrl = graphApiUrl("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    access_token: userAccessToken,
  });
  const accounts = await graphFetch<AccountsResponse>(accountsUrl);
  const page = (accounts.data ?? []).find((item) => item.instagram_business_account?.id && item.access_token);
  if (!page?.instagram_business_account?.id || !page.access_token || !page.id) {
    throw new Error(
      "Kein Instagram Business/Creator-Konto gefunden. Bitte verknuepfe dein Instagram mit einer Facebook-Seite und versuche es erneut.",
    );
  }

  const igUserId = page.instagram_business_account.id;
  const profileUrl = graphApiUrl(`/${igUserId}`, {
    fields: "id,username,name,profile_picture_url",
    access_token: page.access_token,
  });
  const profile = await graphFetch<IgProfileResponse>(profileUrl);
  const username = profile.username?.trim();
  if (!username) throw new Error("Instagram-Benutzername konnte nicht gelesen werden.");

  const expiresAt = new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString();

  return {
    igUserId,
    username,
    profileUrl: `https://www.instagram.com/${username}/`,
    pageId: page.id,
    pageAccessToken: page.access_token,
    tokenExpiresAt: expiresAt,
    connectedAt: new Date().toISOString(),
  };
}

export async function fetchInstagramMedia(connection: StoredInstagramConnection, limit = 12): Promise<InstagramMediaItem[]> {
  const url = graphApiUrl(`/${connection.igUserId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,timestamp",
    limit: String(limit),
    access_token: connection.pageAccessToken,
  });
  const payload = await graphFetch<{ data?: Array<Record<string, unknown>> }>(url);
  const items: InstagramMediaItem[] = [];

  for (const raw of payload.data ?? []) {
    const mediaType = String(raw.media_type ?? "").toUpperCase();
    if (mediaType !== "IMAGE" && mediaType !== "CAROUSEL_ALBUM") continue;
    const mediaUrl = String(raw.media_url ?? raw.thumbnail_url ?? "").trim();
    if (!mediaUrl) continue;
    items.push({
      id: String(raw.id ?? ""),
      mediaType,
      mediaUrl,
      caption: typeof raw.caption === "string" ? raw.caption : "",
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : "",
    });
    if (items.length >= limit) break;
  }

  return items;
}

export async function downloadInstagramImage(mediaUrl: string): Promise<{
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  mime: string;
} | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(mediaUrl, { signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0]?.trim().toLowerCase();
    const mime =
      contentType === "image/png" ? "image/png" : contentType === "image/webp" ? "image/webp" : "image/jpeg";
    const mediaType = mime === "image/png" ? "image/png" : mime === "image/webp" ? "image/webp" : "image/jpeg";

    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength === 0 || raw.byteLength > MAX_IMAGE_BYTES) return null;

    return {
      base64: raw.toString("base64"),
      mediaType,
      mime,
    };
  } catch {
    return null;
  }
}

export async function loadInstagramImagesForAnalysis(
  connection: StoredInstagramConnection,
  maxImages = 5,
): Promise<Array<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp"; mime: string; sourceUrl: string }>> {
  const media = await fetchInstagramMedia(connection, 12);
  const downloaded: Array<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp"; mime: string; sourceUrl: string }> = [];

  for (const item of media) {
    if (downloaded.length >= maxImages) break;
    const image = await downloadInstagramImage(item.mediaUrl);
    if (image) downloaded.push({ ...image, sourceUrl: item.mediaUrl });
  }

  if (downloaded.length < 3) {
    throw new Error("Zu wenige Instagram-Bilder konnten geladen werden. Bitte pruefe deine letzten Posts oder nutze den Screenshot-Upload.");
  }

  return downloaded;
}
