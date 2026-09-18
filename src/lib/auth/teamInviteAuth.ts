/** Safe helper: keep `next` on auth redirect URLs when present. Always absolute if input is. */
export function withNextParam(url: string, next: string | null | undefined) {
  if (!next || next === "/dashboard") return url;
  try {
    const absolute = new URL(url);
    absolute.searchParams.set("next", next);
    return absolute.toString();
  } catch {
    const parsed = new URL(url, "https://brewai.invalid");
    parsed.searchParams.set("next", next);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
}

/** Workspace team invite deep-link (not platform invite-only tokens). */
export function isTeamInviteNextPath(next: string | null | undefined): boolean {
  if (!next) return false;
  const path = next.split("?")[0] ?? "";
  return /^\/invite\/team\/[a-f0-9]{64}$/i.test(path);
}
