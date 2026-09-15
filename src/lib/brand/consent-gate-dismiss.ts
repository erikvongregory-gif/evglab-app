/** Klick-Ziele für Cookie-Banner und Altersgates (DE/EN, gängige CMPs). */
export const CONSENT_AND_AGE_GATE_SELECTORS = [
  // Altersfreigabe DE
  'button:has-text("Ja, ich bin")',
  'button:has-text("Ja ich bin")',
  'button:has-text("Ich bin über 16")',
  'button:has-text("Ich bin über 18")',
  'button:has-text("Ich bin mindestens 16")',
  'button:has-text("Ich bin mindestens 18")',
  'button:has-text("Ja, ich bin volljährig")',
  'button:has-text("Zutritt gewähren")',
  'button:has-text("Eintreten")',
  'button:has-text("Weiter zur Website")',
  'a:has-text("Ja, ich bin")',
  'a:has-text("Ich bin über 16")',
  'a:has-text("Ich bin über 18")',
  '[data-age-gate="accept"]',
  '[data-age-gate-accept]',
  "#age-gate-yes",
  "#age-verify-yes",
  ".age-gate__button--yes",
  ".age-gate-button-yes",
  ".age-verification__accept",
  'input[type="submit"][value*="Ja"]',
  // Cookie CMP DE/EN
  'button:has-text("Alle akzeptieren")',
  'button:has-text("Alle Cookies akzeptieren")',
  'button:has-text("Akzeptieren")',
  'button:has-text("Zustimmen")',
  'button:has-text("Einverstanden")',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Allow all")',
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#onetrust-accept-btn-handler",
  ".uc-btn-accept-all",
  '[data-testid="uc-accept-all-button"]',
  '[data-testid="accept-all"]',
  ".cm-btn-primary",
  "#cookie-accept-all",
  'button[id*="accept" i]',
  'button[class*="accept-all" i]',
] as const;

/** Erkennt HTML, das hauptsächlich aus Alters-/Cookie-Gate besteht (Fetch ohne JS). */
export function looksLikeBlockedGatePage(html: string, textExcerpt: string): boolean {
  const sample = `${html.slice(0, 12000)} ${textExcerpt}`.toLowerCase();
  const ageSignals =
    /(alter\s*(bestät|verif|prüf)|age\s*(gate|verif|check)|bist\s+du\s+bereits|mindestens\s+(16|18)|über\s+(16|18)\s+jahre)/i.test(
      sample,
    );
  const cookieSignals = /(cookie|datenschutz|consent|einwilligung|zustimmen|akzeptieren)/i.test(sample);
  const hasBrandContent =
    /(brauerei|bier|sortiment|über uns|unsere biere|willkommen|tradition|handwerk)/i.test(textExcerpt) &&
    textExcerpt.trim().length > 120;
  if (hasBrandContent) return false;
  return ageSignals || (cookieSignals && textExcerpt.trim().length < 80);
}
