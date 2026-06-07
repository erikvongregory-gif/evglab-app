/**
 * Prompt block for Instagram-style campaign images (text baked into the image).
 * Brand context is appended server-side by the create-task route.
 */
/**
 * Referenzbild(er) + Markenkontext (serverseitig angehängt): Modell erfindet deutschsprachige Headline/Subline/CTA im Bild.
 */
export function buildCampaignCreativeFromReferencesPrompt(scene: string): string {
  const s = scene.trim();
  return [
    "You are creating ONE new Instagram feed post graphic (mobile-first). German ad copy must appear as real baked-in typography in the image (not as a caption).",
    "",
    "REFERENCE-DRIVEN CREATIVE (no fixed headline from user):",
    "- Use the provided reference image(s) only as style/mood/composition inspiration; do NOT duplicate them pixel-for-pixel.",
    "- Invent a fresh layout: new framing, lighting variation, or storytelling beat while staying on-brand.",
    "- YOU must author all on-image German text: a strong HEADLINE, optional SUBLINE, optional CTA — idiomatic, correctly spelled, no gibberish, no warped letters.",
    "- Headline must feel native to the brand voice implied by the brand context block appended by the system.",
    "",
    "USER / SYSTEM SCENE NOTES (may be short):",
    s || "(No extra notes — rely on references + brand context.)",
    "",
    "LAYOUT & READABILITY:",
    "- Reserve generous negative space behind text; avoid busy textures under headline.",
    "- Safe margins from edges; headline must still read at small feed thumbnail size.",
    "- High contrast sans-serif for ad text; no ornate scripts for body/CTA.",
    "",
    "QUALITY: premium campaign polish, intentional lighting, no stock clutter.",
  ].join("\n");
}

export function buildCampaignCreativePrompt(scene: string, headline: string, subline: string, cta: string): string {
  const sub = subline.trim();
  const c = cta.trim();
  return [
    "You are creating a single Instagram feed ad image (mobile-first). German copy must appear as real baked-in typography in the image (not as a separate caption).",
    "",
    "CREATIVE SCENE (visuals, mood, setting, products):",
    scene.trim(),
    "",
    "ON-IMAGE COPY HIERARCHY (strict):",
    `- HEADLINE (largest weight, highest contrast, short line breaks): "${headline.trim()}"`,
    sub ? `- SUBLINE (clearly smaller than headline, supporting only): "${sub}"` : "- SUBLINE: omit or keep very subtle if not specified.",
    c ? `- CTA (smallest, readable button or pill / footer strip): "${c}"` : "- CTA: optional; only if it stays legible at phone width.",
    "",
    "LAYOUT & READABILITY RULES:",
    "- Reserve generous negative space behind text blocks; avoid busy textures under headline.",
    "- Keep safe margins from edges; no text closer than ~6% of frame to borders.",
    "- Headline must dominate; subline must never compete in size or contrast with the headline.",
    "- Use high legibility sans-serif for ad text; avoid ornate scripts for body/CTA.",
    "- Ensure WCAG-like contrast on text vs background; no low-contrast gray-on-gray for headline.",
    "- Mobile feed: assume thumbnail scale; headline must still read at small size.",
    "",
    "BRAND ALIGNMENT:",
    "- Follow brand colors and tone from the brand context appended by the system (do not invent conflicting palette).",
    "- If product bottles appear, keep label identity consistent with the brand context.",
    "",
    "QUALITY:",
    "- Premium campaign polish, clean composition, intentional lighting, no stock-photo clutter.",
    "- No gibberish text, no mirrored letters, no warped typography.",
  ].join("\n");
}
