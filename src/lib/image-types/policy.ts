export type ContentCreationPreset = "hyperreal" | "product_cutout" | "product_studio" | "campaign_social";
export type ContentEngine = "nano_banana" | "chatgpt_image2";

/** Obere Grenze gleichzeitiger Referenz-Data-URLs (UI, Client-Payload, API-Zod). */
export const MAX_REFERENCE_UPLOADS = 5;

export type ImageTypePolicyErrorCode =
  | "FIELD_MISSING"
  | "IMAGE_REQUIRED"
  | "IMAGE_LIMIT_EXCEEDED"
  | "ENGINE_MISMATCH"
  | "TYPE_POLICY_VIOLATION";

export type ImageTypePolicyViolation = {
  code: ImageTypePolicyErrorCode;
  message: string;
};

type ImageTypePolicyDefinition = {
  id: ContentCreationPreset;
  mode: "standard" | "campaign";
  engine: ContentEngine;
  requiredHybridFields: readonly string[];
  upload: {
    min: number;
    max: number;
  };
};

export const IMAGE_TYPE_POLICIES: Record<ContentCreationPreset, ImageTypePolicyDefinition> = {
  hyperreal: {
    id: "hyperreal",
    mode: "standard",
    engine: "nano_banana",
    requiredHybridFields: ["bildtyp", "biertyp", "behaelter", "markenname", "zielgruppe", "plattform", "stimmung", "shotType"],
    upload: { min: 0, max: MAX_REFERENCE_UPLOADS },
  },
  product_cutout: {
    id: "product_cutout",
    mode: "standard",
    engine: "chatgpt_image2",
    requiredHybridFields: ["produkt", "perspektive", "freisteller_spezifikation", "label_anforderung"],
    upload: { min: 1, max: 1 },
  },
  product_studio: {
    id: "product_studio",
    mode: "standard",
    engine: "nano_banana",
    requiredHybridFields: ["produkt", "studio_hintergrund", "licht_setup", "komposition", "props"],
    upload: { min: 0, max: MAX_REFERENCE_UPLOADS },
  },
  campaign_social: {
    id: "campaign_social",
    mode: "campaign",
    engine: "chatgpt_image2",
    requiredHybridFields: ["motiv", "headline", "subline_oder_keine", "cta_oder_keine", "kampagnenziel", "brandfarben"],
    upload: { min: 1, max: MAX_REFERENCE_UPLOADS },
  },
};

export function getRequiredFieldsByPreset(preset: ContentCreationPreset): readonly string[] {
  return IMAGE_TYPE_POLICIES[preset].requiredHybridFields;
}

export function getPolicyForPreset(preset: ContentCreationPreset): ImageTypePolicyDefinition {
  return IMAGE_TYPE_POLICIES[preset];
}

export function getPresetSystemDirectives(preset: ContentCreationPreset): string {
  if (preset === "product_cutout") {
    return [
      "Preset objective: Product cutout only.",
      "Final prompt must force a true transparent alpha cutout with one centered product and clean edges.",
      "Forbid environment, props, people, text overlays, decorative elements, and non-transparent backgrounds.",
    ].join(" ");
  }
  if (preset === "product_studio") {
    return [
      "Preset objective: Controlled premium studio product visual.",
      "Final prompt must include explicit studio background art direction, key/fill/rim lighting behavior, and optional curated brewery props.",
      "Ensure hero label readability and high-end commercial quality.",
    ].join(" ");
  }
  if (preset === "campaign_social") {
    return [
      "Preset objective: Instagram campaign image with strong on-image copy hierarchy.",
      "Final prompt must enforce headline dominance, readable typography, clear copy-space, and mobile-feed legibility.",
      "Text quality constraints are mandatory (no gibberish or warped typography).",
      "When reference images are provided without fixed user copy, invent short natural German headline/subline/CTA aligned with brand context and reference visual language.",
    ].join(" ");
  }
  return [
    "Preset objective: Hyperreal photographic motif only.",
    "Final prompt must strictly avoid illustration/CGI/stylized look and enforce physically plausible realism.",
  ].join(" ");
}

export function applyContentPresetPrompt(basePrompt: string, preset: ContentCreationPreset): string {
  const trimmed = basePrompt.trim();
  if (!trimmed) return "";
  if (preset === "product_cutout") {
    return [
      trimmed,
      "",
      "Preset lock (NON-NEGOTIABLE): Product Cutout",
      "- Output type must be a true freisteller: transparent alpha background only.",
      "- Render exactly one hero product, centered, complete silhouette visible.",
      "- No background scene, no gradient backdrop, no floor, no environment, no props, no people, no text overlay.",
      "- Edge quality must be production-grade: no halo, no fringing, no jagged cut lines, no glow artifacts.",
      "- Product geometry, branding and label typography must stay authentic and fully readable.",
      "- Keep only a subtle natural contact shadow directly under the product if needed for depth; no cast shadows outside product area.",
      "- Final image must be e-commerce ready PNG cutout.",
    ].join("\n");
  }
  if (preset === "product_studio") {
    return [
      trimmed,
      "",
      "Preset lock (NON-NEGOTIABLE): Product Studio",
      "- Controlled premium studio look with deliberate art direction and clean visual hierarchy.",
      "- Hero product is the strongest focal point; keep the label razor-sharp and fully legible.",
      "- Use purposeful studio lighting setup (key/fill/rim), controlled reflections, and realistic soft contact shadow.",
      "- Background must be a designed studio backdrop (e.g. gradient paper sweep, textured acrylic, color gel accents), not random lifestyle environment.",
      "- Add only curated companion elements that support the product story (e.g. hops, barley, citrus, herbs, condensation accents), with strict clutter control.",
      "- Composition must read like a high-end commercial beverage campaign, not a catalog-only flat packshot.",
      "- No people, no chaotic props, no noisy background.",
    ].join("\n");
  }
  if (preset === "hyperreal") {
    return [
      trimmed,
      "",
      "Preset lock (NON-NEGOTIABLE): Hyperreal Motif",
      "- Output must look indistinguishable from a real camera photograph.",
      "- Enforce physically plausible lighting, real material response, true-to-life reflections, and natural imperfections.",
      "- Human anatomy and skin detail must be fully realistic (no beauty-filter skin, no uncanny face/hands artifacts).",
      "- Real-world scene context only (no sterile packshot and no synthetic render environment).",
      "- Strictly forbid illustration, cartoon, painting, CGI, 3D render, or stylized AI-art look.",
    ].join("\n");
  }
  if (preset === "campaign_social") {
    return [
      trimmed,
      "",
      "Preset lock (NON-NEGOTIABLE): Campaign Image With Text",
      "- Must be an Instagram-ready campaign visual with strong ad-style hierarchy and clear focal storytelling.",
      "- On-image copy must be premium and conversion-oriented: headline dominates, subline supports, CTA is concise and high-intent.",
      "- Keep strict readability at mobile feed size (high contrast, safe margins, clean typography zones, no clutter under text).",
      "- Text must be correctly spelled and visually coherent; no gibberish, no warped letters, no mirrored words.",
      "- No flyer collage look, no generic stock composition, no weak low-contrast headline treatment.",
    ].join("\n");
  }
  return trimmed;
}

export function validateImageTypePolicy(input: {
  preset: ContentCreationPreset;
  engine: ContentEngine;
  referenceImageCount: number;
  campaignMode?: boolean;
}): ImageTypePolicyViolation | null {
  const policy = getPolicyForPreset(input.preset);
  if (policy.engine !== input.engine) {
    return {
      code: "ENGINE_MISMATCH",
      message: `Der Bildtyp "${input.preset}" darf nur mit ${policy.engine} erzeugt werden.`,
    };
  }
  if (input.referenceImageCount < policy.upload.min) {
    return {
      code: "IMAGE_REQUIRED",
      message:
        input.preset === "campaign_social"
          ? "Für Kampagnenbild mit Text mindestens ein Referenzbild hochladen (z. B. Screenshot bestehender Instagram-Posts)."
          : "Für diesen Bildtyp ist ein Produktbild erforderlich.",
    };
  }
  if (input.referenceImageCount > policy.upload.max) {
    return {
      code: "IMAGE_LIMIT_EXCEEDED",
      message: `Für diesen Bildtyp sind maximal ${policy.upload.max} Referenzbild(er) erlaubt.`,
    };
  }
  if (policy.mode === "campaign" && input.campaignMode !== true) {
    return {
      code: "TYPE_POLICY_VIOLATION",
      message: "Dieser Bildtyp muss im Kampagnenmodus erzeugt werden.",
    };
  }
  if (policy.mode !== "campaign" && input.campaignMode === true) {
    return {
      code: "TYPE_POLICY_VIOLATION",
      message: "Dieser Bildtyp unterstützt keinen Kampagnenmodus.",
    };
  }
  return null;
}
