import type { CampaignTextInput } from "../schemas";

const ZIEL_TEXTE = {
  produkt_launch: "new product launch announcement",
  event_ankuendigung: "event announcement (concert, tap takeover, festival)",
  saisonal: "seasonal campaign (Oktoberfest, summer, Christmas, etc.)",
  behind_the_scenes: "behind-the-scenes brewery glimpse",
  rezept_pairing: "food pairing recommendation",
  community_engagement: "community / lifestyle moment",
  edukativ_bierwissen: "educational beer knowledge post",
  sale_aktion: "promotional / sale offer",
} as const;

export function buildCampaignTextPrompt(input: CampaignTextInput): string {
  return `
INSTAGRAM CAMPAIGN POST for craft brewery "${input.brauereiName}".

STYLE REFERENCE: Match the visual style, color grading, composition rules, and tonal mood of the 5 reference images provided (treat them as the brand's existing Instagram feed aesthetic). Maintain visual consistency with that feed — same color palette, same lighting language, same compositional rhythm.

POST PURPOSE: ${ZIEL_TEXTE[input.postZiel]}.
${input.bierstilOderProdukt ? `FEATURED PRODUCT: ${input.bierstilOderProdukt}.` : ""}

TEXT OVERLAY — render the following text directly into the image, integrated into the design:

  HEADLINE (large, prominent): "${input.headline}"
  ${input.subline ? `SUBLINE (smaller): "${input.subline}"` : ""}
  ${input.ctaText ? `CTA (bottom, clear): "${input.ctaText}"` : ""}

TEXT RENDERING RULES:
- Typography must be legible at thumbnail size
- German umlauts (ä, ö, ü, ß) MUST render correctly
- Text placement respects the composition, doesn't cover the hero subject
- Font choice should feel native to the brand style shown in references (modern sans-serif if feed is contemporary, serif if classic, hand-lettered if rustic)

FORMAT: ${input.aspectRatio} aspect ratio, Instagram-native.

${input.zusatzKontext ? `ADDITIONAL CONTEXT: ${input.zusatzKontext}` : ""}

QUALITY: Editorial, on-brand, scroll-stopping. Not generic AI aesthetic. Feel like it was designed by a human social media designer who knows this brewery.
  `.trim();
}
