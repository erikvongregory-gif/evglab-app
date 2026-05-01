/**
 * Scrollt zum Abschnitt mit der gegebenen Hash-ID (ohne #).
 * Berücksichtigt duplizierte IDs in #mobile-content / #desktop-content.
 */
export function scrollToSection(hash: string) {
  const id = hash.replace(/^#/, "");
  if (!id || typeof window === "undefined") return;
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  const wrapper = document.getElementById(
    isDesktop ? "desktop-content" : "mobile-content",
  );
  const target =
    wrapper?.querySelector(`#${CSS.escape(id)}`) ??
    document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", hash.startsWith("#") ? hash : `#${id}`);
  }
}
