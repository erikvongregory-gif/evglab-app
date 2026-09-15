/** Bild-Prompt-Zusatz: Motiv ohne Text, Platz für serverseitiges Typo-Overlay. */
export const COPY_SPACE_DIRECTIVE = [
  "COPY-SPACE LOCK (NON-NEGOTIABLE):",
  "- Do NOT render any text, letters, words, numbers, typography, captions, hashtags, or logo text in the image.",
  "- Leave the upper 38% of the frame as clean, uncluttered negative space (soft gradient or calm background only).",
  "- Place the hero product/scene in the lower 62% — strong focal point, no clutter under the future headline zone.",
  "- No fake placeholder text blocks, no lorem ipsum, no UI chrome.",
].join("\n");

export function appendCopySpaceDirective(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return COPY_SPACE_DIRECTIVE;
  return `${trimmed}\n\n${COPY_SPACE_DIRECTIVE}`;
}
