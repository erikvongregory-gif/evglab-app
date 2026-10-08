/** Clarify ordinary adult lifestyle scenes before the first provider request. */
export const ADULT_SCENE_CONTEXT = [
  "AGE CONTEXT FOR THIS BEER LIFESTYLE SCENE:",
  'When adult people have no specific age (for example "junge Frauen" or "young men"), depict clearly adult people aged 25 or older.',
  "Preserve explicitly stated ages and the age of people in reference images; do not relabel minors as adults.",
  "Do not depict minors consuming or promoting alcohol. Do not add people to a product-only scene.",
].join(" ");

export function withAdultSceneContext(prompt: string, maxLength = 12_000): string {
  const context = `${ADULT_SCENE_CONTEXT}\n\n`;
  return context + prompt.slice(0, Math.max(0, maxLength - context.length));
}

/** Spät im Prompt: überlebt die Kürzung und wiegt schwerer als Szenen-Freitext. */
export const CUSTOMER_IMAGE_SAFETY_LOCK = [
  "CUSTOMER SAFETY LOCK (NON-NEGOTIABLE):",
  "Commercial brand photo only.",
  "No political content anywhere in the frame: no stickers, posters, graffiti, flyers, flags, slogans, party names, protest signs, or campaign text on walls, doors, clothing, glass, or street furniture.",
  "If a reference shows any of that, do not reproduce it. Surfaces stay free of readable third-party lettering. The only allowed brand text is the customer's own product label.",
  "Anatomy: every visible person is a separate intact adult.",
  // Reportage-Crops (Selfie-Arm, Arm im Vordergrund) erzeugten sonst eine dritte Hand.
  "Each person has exactly two arms and two hands; every visible hand joins one person by a continuous arm — never a third arm or a stray forearm. A selfie-taker has one free hand.",
  "Each foot is fully inside its own shoe or clearly bare on the ground — never half inside a shoe, never fused through footwear, furniture, or another person.",
  "No melted limbs, extra legs, merged bodies, or people baked into objects.",
].join(" ");

export function appendCustomerImageSafety(prompt: string, maxLength = 12_000): string {
  const lock = `\n\n${CUSTOMER_IMAGE_SAFETY_LOCK}`;
  return prompt.slice(0, Math.max(0, maxLength - lock.length)) + lock;
}
