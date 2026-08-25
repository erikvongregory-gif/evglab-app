/**
 * Soft-Launch: Warteliste statt Login.
 * Go-live: auf `process.env.NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED !== "0"` zurückstellen
 * und in Vercel `NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED=0` setzen + Redeploy.
 */
export const LOGIN_WAITLIST_ENABLED = true;

/** Videos Erstellen — erst live schalten, wenn NEXT_PUBLIC_VIDEOS_CREATE_ENABLED=true gesetzt ist. */
export function isVideosCreateEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VIDEOS_CREATE_ENABLED === "true";
}
