/** Client-seitige Abmeldung — leitet nach erfolgreichem Sign-out zum Login. */
export async function signOutAndRedirect(loginPath = "/anmelden?notice=signed_out"): Promise<void> {
  try {
    await fetch("/auth/signout", {
      method: "POST",
      credentials: "include",
      redirect: "follow",
    });
  } catch {
    /* Session trotzdem beenden versuchen */
  }
  window.location.assign(loginPath);
}
