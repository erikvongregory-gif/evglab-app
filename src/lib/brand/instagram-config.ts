export const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v22.0";

export function isInstagramOAuthConfigured(): boolean {
  return Boolean(getMetaAppId() && getMetaAppSecret());
}

export function getMetaAppId(): string | undefined {
  return process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim() || undefined;
}

export function getMetaAppSecret(): string | undefined {
  return process.env.META_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim() || undefined;
}

export function getInstagramOAuthScopes(): string[] {
  return ["instagram_basic", "pages_show_list", "pages_read_engagement"];
}

export function buildInstagramRedirectUri(appOrigin: string): string {
  return new URL("/api/brand/instagram/callback", appOrigin).toString();
}

export function graphApiUrl(path: string, searchParams?: Record<string, string>): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}${normalized}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
