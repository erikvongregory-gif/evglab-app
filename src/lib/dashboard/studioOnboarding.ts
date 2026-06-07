export function studioOnboardingStorageKey(userEmail?: string): string {
  const id = userEmail?.trim().toLowerCase() || "default";
  return `evglab:studio-onboarding-v1:${id}`;
}

export function isStudioOnboardingComplete(userEmail?: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(studioOnboardingStorageKey(userEmail)) === "1";
  } catch {
    return true;
  }
}

export function markStudioOnboardingComplete(userEmail?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(studioOnboardingStorageKey(userEmail), "1");
  } catch {
    /* ignore */
  }
}
