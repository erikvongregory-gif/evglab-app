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
