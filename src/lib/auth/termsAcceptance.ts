/** Versionsstempel für nachweisbare AGB-/Datenschutz-Zustimmung. */
export const TERMS_ACCEPTANCE_VERSION = "2026-09-16";

export const TERMS_ACCEPTANCE_COOKIE = "brewai_terms_accepted";

export const TERMS_ACCEPTANCE_FORM_FIELD = "accepted_terms";

export function isTruthyTermsAcceptance(value: FormDataEntryValue | string | null | undefined): boolean {
  if (value == null) return false;
  const raw = String(value).trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export function termsAcceptanceMetadata(acceptedAt = new Date().toISOString()) {
  return {
    terms_accepted_at: acceptedAt,
    terms_version: TERMS_ACCEPTANCE_VERSION,
    privacy_accepted_at: acceptedAt,
    privacy_version: TERMS_ACCEPTANCE_VERSION,
  };
}
