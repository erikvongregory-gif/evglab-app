/** Shared direction for generated and deterministic beverage prompts. */
export const IMAGE_PROMPT_SECTIONS = [
  "ZWECK UND MEDIUM",
  "SZENE UND HANDLUNG",
  "HAUPTMOTIV UND PRODUKTDETAILS",
  "KOMPOSITION UND KAMERA",
  "LICHT FARBEN UND STIMMUNG",
  "REFERENZEN UND BEIZUBEHALTENDE MERKMALE",
  "FORMAT UND RELEVANTE AUSSCHLÜSSE",
] as const;

export const IMAGE_DIRECTION_PRIORITY = "The user brief defines the scene, people and action. Product and shape references define identity and geometry only. Look references guide photographic treatment within that scene; never replace the requested action or location. Explicit user lighting and camera instructions take priority over style defaults. Use one coherent camera and lighting setup.";

export const IMAGE_PROMPT_WRITING_RULES = `Use this order: Purpose/Medium → Scene/Action → Subject/Product details → Composition/Camera → Light/Colors/Mood → References/Preserve → Format/Relevant exclusions.
Describe observable results: light source and direction, camera height, framing, subject focus and background blur. Add lens/aperture only when useful; avoid decorative technical specs.
Give each reference image an indexed, exclusive role. State each preservation rule once. Include only constraints relevant to visible objects; avoid repeated locks and generic negative lists.
For edits, name the requested change and explicitly preserve everything else. Quote exact requested text and specify placement and typography.
${IMAGE_DIRECTION_PRIORITY}`;
