import type { ProductIsolateInput } from "../schemas";

export function buildProductIsolatePrompt(input: ProductIsolateInput): string {
  const bgText = {
    transparent: "fully transparent background (alpha channel)",
    weiss: "pure white seamless background #FFFFFF",
    schwarz: "pure black seamless background #000000",
  }[input.hintergrund];

  return `
PRODUCT CUTOUT / ISOLATION TASK.

Isolate the beer bottle (and any glass if visible) from the reference image. Preserve every detail of the label, the bottle glass color, the cap, the liquid color visible through the glass. Place onto a ${bgText}.

${input.schattenErhalten ? "Keep a soft natural contact shadow under the bottle for grounding." : "No shadow."}

DO NOT redraw, restyle, or reinterpret the label or bottle. Pixel-faithful isolation only. Clean edges, no halo, no fringing. Studio-grade alpha matte quality.
  `.trim();
}
