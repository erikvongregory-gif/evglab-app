/** Soft-Launch: Production zeigt die Warteliste. Lokal mit `=0` bleibt der Login.
 *  Go-live: in Vercel `NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED=off` setzen und neu deployen. */
export const LOGIN_WAITLIST_ENABLED =
  process.env.NODE_ENV === "development"
    ? process.env.NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED === "1"
    : process.env.NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED !== "off" &&
      process.env.NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED !== "false";

/** Videos Erstellen — erst live schalten, wenn NEXT_PUBLIC_VIDEOS_CREATE_ENABLED=true gesetzt ist. */
export function isVideosCreateEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VIDEOS_CREATE_ENABLED === "true";
}
