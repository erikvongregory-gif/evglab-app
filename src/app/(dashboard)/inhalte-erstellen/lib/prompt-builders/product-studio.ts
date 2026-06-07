import { GLAS_TYPEN, STUDIO_PROPS_BY_BIERSTIL, type Bierstil, type GlasTyp } from "../brewing-knowledge";
import type { ProductStudioInput } from "../schemas";

const HINTERGRUND_DESCRIPTIONS = {
  naturholz_warm: "warm natural oak wood surface, slight grain visible",
  marmor_hell: "light Carrara marble surface, subtle veining",
  schiefer_dunkel: "dark slate stone surface, matte texture",
  leinen_rustikal: "rustic natural linen fabric, soft folds",
  studio_gradient_warm: "seamless studio backdrop, warm beige-to-cream gradient",
  studio_gradient_kuehl: "seamless studio backdrop, cool blue-grey gradient",
  outdoor_naturlich: "natural outdoor setting, wooden table with greenery softly out of focus",
} as const;

export const DEFAULT_GLAS_BY_STIL: Record<Bierstil, GlasTyp> = {
  hefeweizen: "weizen",
  kristallweizen: "weizen",
  pils: "pils_tulpe",
  helles_lager: "willibecher",
  helles: "willibecher",
  ipa: "ipa_teku",
  neipa: "ipa_teku",
  stout: "schwenker",
  porter: "schwenker",
  bock: "schwenker",
  saison: "ipa_teku",
  kellerbier: "willibecher",
  rauchbier: "willibecher",
};

export function resolveStudioGlas(input: Pick<ProductStudioInput, "bierstil" | "glasTyp">): GlasTyp {
  return input.glasTyp ?? DEFAULT_GLAS_BY_STIL[input.bierstil];
}

export function buildProductStudioPrompt(input: ProductStudioInput): string {
  const props = input.customProps ? input.customProps : STUDIO_PROPS_BY_BIERSTIL[input.bierstil].join(", ");
  const glasKey = resolveStudioGlas(input);
  const glas = GLAS_TYPEN[glasKey];

  const lichtText = {
    weich_diffuse: "soft diffused studio light from large softbox, gentle shadows",
    hart_dramatisch: "single hard light source from side, dramatic shadows, high contrast",
    natuerlich_fensterlicht: "natural window light from left, soft falloff",
  }[input.lichtStimmung];

  return `
COMMERCIAL PRODUCT STUDIO PHOTOGRAPHY for a craft brewery.

HERO PRODUCT: The beer bottle from the reference image, with the label reproduced 1:1 EXACTLY — same artwork, typography, colors, proportions. The label is a fixed graphic asset, not to be reinterpreted.

${
  input.glasNebenFlasche
    ? `COMPANION GLASS: A ${glas.promptDescription}, freshly poured beer matching the style "${input.bierstil}".`
    : ""
}

STYLING / PROPS arranged tastefully around the product: ${props}. Props are accents, not clutter — composition follows the rule of thirds, breathing space around the hero bottle.

SURFACE / BACKGROUND: ${HINTERGRUND_DESCRIPTIONS[input.hintergrundStil]}.

LIGHTING: ${lichtText}. Bottle has subtle highlight on the shoulder, label is fully readable and evenly lit. Slight condensation droplets allowed but realistic (not stickered-on look).

CAMERA: Medium-format quality, 100mm macro or 85mm lens equivalent, f/5.6, tack-sharp on the label, gentle bokeh on background props.

STYLE: Editorial product photography, magazine-quality, reminiscent of high-end craft brewery campaigns. No AI-glossy look, no oversaturation, authentic textures.

NEGATIVE: warped label, distorted text, wrong bottle shape, plastic-looking glass, oversaturated colors, cluttered composition, generic stock-photo feel, cartoonish, painted style, melted glass, floating props.
  `.trim();
}
