import { type ProductStudioInput, type CampaignTextInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { GLAS_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import { resolveGlasTyp } from "@/app/(dashboard)/inhalte-erstellen/lib/beer-styles";
import { BEER_PHYSICS } from "@/lib/beverages/beer-appearance";
import { buildFreeformImagePromptV3 } from "./image-prompt-v3";

const backgrounds = {
  naturholz_warm: "warm natural oak wood surface",
  marmor_hell: "light marble surface",
  schiefer_dunkel: "dark matte slate surface",
  leinen_rustikal: "rustic linen fabric",
  studio_gradient_warm: "warm beige-to-cream seamless studio backdrop",
  studio_gradient_kuehl: "cool grey seamless studio backdrop",
  outdoor_naturlich: "outdoor wooden table with natural greenery",
};
const lights = {
  weich_diffuse: "soft diffused studio light",
  hart_dramatisch: "hard directional light with dramatic shadows",
  natuerlich_fensterlicht: "natural window light",
};

export function buildStudioPromptV3(input: ProductStudioInput): string {
  const scene = `Product photograph on ${backgrounds[input.hintergrundStil]} with ${lights[input.lichtStimmung]}. ${input.customProps ? `Requested props: ${input.customProps}.` : "No added decorative props."}`;
  const glass = GLAS_TYPEN[resolveGlasTyp(input.bierstil, input.glasTyp)];
  const beer = BEER_PHYSICS[input.bierstil];
  return buildFreeformImagePromptV3({
    imageType: "product_studio", referenceCount: 1, strictLabel: true,
    aspectRatio: input.aspectRatio,
    scene: [scene, "Preserve the reference product's actual container shape and proportions. Product-only image, no people.",
      input.glasNebenFlasche
        ? `Companion glass: ${glass.promptDescription}. Beverage: ${input.bierstil}.${beer ? ` Liquid: ${beer.liquid}; foam: ${beer.foam}, ${beer.head}.` : ""}`
        : "Container only; no poured glass.",
    ].join(" "),
  });
}

export function buildCampaignPromptV3(input: CampaignTextInput): string {
  return buildFreeformImagePromptV3({
    imageType: "campaign_social", aspectRatio: input.aspectRatio,
    referenceCount: input.referenzBilder.length,
    scene: [
      `Create a campaign image for ${input.brauereiName}. Purpose: ${input.postZiel}.`,
      input.bierstilOderProdukt ? `Requested product: ${input.bierstilOderProdukt}.` : "",
      input.zusatzKontext || "",
      `Render the exact headline ${JSON.stringify(input.headline)} legibly.`,
      input.subline ? `Subline: ${JSON.stringify(input.subline)}.` : "",
      input.ctaText ? `Call to action: ${JSON.stringify(input.ctaText)}.` : "",
    ].filter(Boolean).join(" "),
  });
}
