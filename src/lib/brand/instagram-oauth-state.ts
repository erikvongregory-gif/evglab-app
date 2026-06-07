import { createHash, randomBytes } from "node:crypto";

const COOKIE_NAME = "evg_ig_oauth";

export type InstagramOAuthState = {
  state: string;
  userId: string;
  returnTo: string;
};

export function createInstagramOAuthState(userId: string, returnTo: string): InstagramOAuthState {
  return {
    state: randomBytes(24).toString("hex"),
    userId,
    returnTo: sanitizeReturnTo(returnTo),
  };
}

export function serializeInstagramOAuthState(payload: InstagramOAuthState): string {
  return JSON.stringify(payload);
}

export function parseInstagramOAuthState(raw: string | undefined): InstagramOAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as InstagramOAuthState;
    if (!parsed.state || !parsed.userId) return null;
    return {
      state: String(parsed.state),
      userId: String(parsed.userId),
      returnTo: sanitizeReturnTo(parsed.returnTo ?? "/dashboard?tab=brand&openBrand=1&brandInput=instagram"),
    };
  } catch {
    return null;
  }
}

export function sanitizeReturnTo(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return "/dashboard?tab=brand&openBrand=1&brandInput=instagram";
  if (trimmed.startsWith("//")) return "/dashboard?tab=brand&openBrand=1&brandInput=instagram";
  return trimmed.slice(0, 500);
}

export function instagramOAuthCookieName(): string {
  return COOKIE_NAME;
}

export function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}
