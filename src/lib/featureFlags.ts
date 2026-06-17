export const LOGIN_WAITLIST_ENABLED = process.env.NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED !== "0";

/** Videos Erstellen — erst live schalten, wenn NEXT_PUBLIC_VIDEOS_CREATE_ENABLED=true gesetzt ist. */
export function isVideosCreateEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VIDEOS_CREATE_ENABLED === "true";
}
