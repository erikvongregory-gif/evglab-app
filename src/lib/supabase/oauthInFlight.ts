/** Verhindert parallele/doppelte Verarbeitung desselben OAuth-Codes (lokal + Single-Server). */
const inFlight = new Map<string, number>();
const completed = new Map<string, number>();
const TTL_MS = 5 * 60 * 1000;

function prune(map: Map<string, number>) {
  const now = Date.now();
  for (const [key, ts] of map) {
    if (now - ts > TTL_MS) map.delete(key);
  }
}

export type OAuthCodeGate = "proceed" | "wait";

export function acquireOAuthCode(code: string): OAuthCodeGate {
  prune(inFlight);
  prune(completed);
  if (completed.has(code) || inFlight.has(code)) return "wait";
  inFlight.set(code, Date.now());
  return "proceed";
}

export function completeOAuthCode(code: string) {
  inFlight.delete(code);
  completed.set(code, Date.now());
}

export function releaseOAuthCode(code: string) {
  inFlight.delete(code);
}

export function isOAuthCodeCompleted(code: string) {
  prune(completed);
  return completed.has(code);
}

export function isOAuthCodeInFlight(code: string) {
  prune(inFlight);
  return inFlight.has(code);
}
