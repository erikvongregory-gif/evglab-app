import { FLASCHEN_TYPEN, GLAS_TYPEN, flascheVolumeMl, glassPourPromptDescription, isDoseTyp, pouredGlassFillMl } from "../brewing-knowledge";
import type { HyperrealisticInput } from "../schemas";

type BeerPhysicsProfile = {
  srm: string;
  hex: string;
  liquid: string;
  foam: string;
  carbonation: string;
};

const BEER_PHYSICS: Record<string, BeerPhysicsProfile> = {
  helles: {
    srm: "3–5",
    hex: "#F8D975",
    liquid: "crystal-clear pale golden lager with warm glow-through when backlit",
    foam: "dense ivory-white foam crown with fine uniform pores and delicate lacing on glass walls",
    carbonation: "fine ascending pearl-like bubbles in steady streams",
  },
  pils: {
    srm: "2–4",
    hex: "#F5E08A",
    liquid: "brilliant pale straw-gold Pilsner with crystal clarity and crisp brilliance",
    foam: "tight compact brilliant-white foam cap with micro-fine pores and clean lacing rings",
    carbonation: "lively fine carbonation with crisp ascending bubble trails",
  },
  hefeweizen: {
    srm: "4–6",
    hex: "#F5A623",
    liquid: "hazy golden-orange wheat beer with natural yeast turbidity and warm glowing opacity",
    foam: "towering fluffy white foam head with large irregular pores, spectacular retention, never plastic-dome shaped",
    carbonation: "vigorous effervescent streams rising through the haze",
  },
  kristallweizen: {
    srm: "3–5",
    hex: "#F0C850",
    liquid: "crystal-clear filtered golden wheat beer with brilliant clarity",
    foam: "firm white foam cap with moderate retention and natural irregular edge",
    carbonation: "steady medium-fine carbonation streams",
  },
  maerzen: {
    srm: "9–14",
    hex: "#C87941",
    liquid: "warm burnished copper-amber Märzen with deep orange-copper glow and ruby edge in backlight",
    foam: "firm dense white foam crown with good retention, traditional Bavarian head",
    carbonation: "steady medium carbonation with natural bubble trails",
  },
  kellerbier: {
    srm: "8–12",
    hex: "#D4A850",
    liquid: "naturally cloudy hazy pale golden-amber Kellerbier with gentle yeast turbidity",
    foam: "soft hazy off-white foam with rustic texture and moderate retention",
    carbonation: "low to moderate gentle carbonation bubbles",
  },
  bock: {
    srm: "14–22",
    hex: "#9B5523",
    liquid: "rich deep amber to dark copper-brown Bock with warm chestnut tones and ruby edge glow",
    foam: "moderate dense off-white to cream foam, thick and persistent",
    carbonation: "moderate smooth carbonation streams",
  },
  koelsch: {
    srm: "3–5",
    hex: "#F8D975",
    liquid: "pale straw-gold Kölsch with brilliant clarity",
    foam: "delicate thin white foam cap, quickly dissipating, minimal lacing",
    carbonation: "moderate fine carbonation, clean streams",
  },
  altbier: {
    srm: "11–19",
    hex: "#9B4521",
    liquid: "deep amber to copper-brown Altbier with warm reddish-copper tones",
    foam: "tight compact tan-white foam with moderate retention",
    carbonation: "moderate fine carbonation, clean streams",
  },
  ipa: {
    srm: "8–14",
    hex: "#D4843A",
    liquid: "deep amber to copper IPA with slight haze and warm orange-amber clarity",
    foam: "moderate off-white foam with medium pores and light sticky lacing",
    carbonation: "moderate effervescence with scattered bubble trails",
  },
  neipa: {
    srm: "4–7",
    hex: "#F5C842",
    liquid: "opaque pale citrus-yellow hazy NEIPA with dense unfiltered protein haze and juicy opacity",
    foam: "soft pillowy white foam with silky texture and moderate retention",
    carbonation: "gentle lazy carbonation with soft bubble clusters visible through haze",
  },
  stout: {
    srm: "35–40+",
    hex: "#160800",
    liquid: "opaque jet-black stout with absolutely no light transmission, velvety black body",
    foam: "thick velvety cream-colored mousse-like nitrogen foam with extremely fine texture",
    carbonation: "minimal surface carbonation with occasional slow bubbles, nitrogen cascade feel",
  },
  porter: {
    srm: "25–30",
    hex: "#3D1105",
    liquid: "deep mahogany-brown porter with ruby-garnet edge translucency when backlit",
    foam: "thin tan-brown foam layer with medium pores",
    carbonation: "gentle steady carbonation streams",
  },
  saison: {
    srm: "5–14",
    hex: "#E0A030",
    liquid: "golden to amber saison with light rustic yeast haze and warm golden turbidity",
    foam: "dense fluffy white foam with large pores, very high retention, Belgian-style rocky head",
    carbonation: "vigorous fine streams, lively effervescence",
  },
  radler: {
    srm: "2–5",
    hex: "#FAE86B",
    liquid: "hazy pale golden-lemon Radler with cloudy lemon-gold body and subtle citrus particles",
    foam: "light bubbly white foam, quickly fading",
    carbonation: "sparkling lively effervescence",
  },
  alkoholfrei_pilsner: {
    srm: "3–4",
    hex: "#F8E080",
    liquid: "brilliant pale golden alcohol-free Pilsner, clean and fresh straw gold",
    foam: "light airy white foam with moderate retention",
    carbonation: "crisp lively micro-bubbles",
  },
};

const CAMERA_BY_SHOT: Record<NonNullable<HyperrealisticInput["shotType"]>, string> = {
  A: "Handheld Canon EOS R6, 50mm at f/4, slight 45° angle, available light, product sharp, background naturally falling off — not cinematic bokeh",
  B: "Handheld Canon EOS R6, 50mm at f/4, eye-level, natural perspective, label fully sharp",
  C: "Handheld Canon EOS R6, 35mm at f/4, slight low angle, physically plausible perspective, no superhero tilt",
  D: "Handheld Canon EOS R6, 50mm at f/5.6, top-down, natural shadow falloff",
  E: "Handheld Canon EOS R6, 85mm at f/4, close-up of glass, condensation and label texture, thin but honest focal plane",
  F: "Handheld Canon EOS R6, 35mm at f/5.6, wide environmental framing, authentic venue scale",
  G: "Aerial drone perspective at moderate altitude, 24mm equivalent, realistic geometry",
  H: "Over-shoulder handheld, 35mm at f/2.8, first-person, believable hand scale, slight motion of a real hold",
};

const SCENE_TEXTURE_ANCHORS: Record<HyperrealisticInput["szene"], string> = {
  biergarten_sommer:
    "weathered wooden table grain with real scratches, gravel pebbles with uneven size, chestnut leaf dappled shadows with soft penumbra, distant guest clothing with natural fabric folds",
  wirtshaus_innen:
    "dark wood paneling with visible grain and age marks, checkered tablecloth weave, warm tungsten practical lights with soft falloff, subtle glass reflections on polished surfaces",
  kueche_zuhause:
    "marble countertop with natural veining and micro-scratches, soft window light with realistic shadow direction, everyday kitchen props with lived-in imperfections",
  wiese_picknick:
    "woven picnic blanket texture, wildflower stems with irregular spacing, soft grass blades in foreground blur, natural uneven ground contact shadows",
  strand_sonnenuntergang:
    "fine beach sand grains, gentle wave foam at shoreline, warm sunset color temperature gradient in sky, salt-air moisture on glass surface",
  alpenpanorama:
    "rough alpine wood railing texture, crisp mountain air clarity, subtle wind movement in clothing, distant peak atmospheric haze",
  stadtbalkon_abend:
    "urban balcony metal rail with real patina, city light bokeh with natural circle-of-confusion, evening ambient mixed lighting, believable depth between foreground and skyline",
  brauereihof:
    "copper kettle patina and brushed metal reflections, industrial-rustic stone or brick textures, brewery courtyard ground wear, authentic production-environment grime and warmth",
  fussball_public_viewing:
    "LED screen glow with realistic bloom on faces, plastic cup and jersey fabric textures, crowd depth layers with natural motion blur, outdoor event lighting spill",
};

export const HYPERREALISM_NEGATIVE =
  "illustration, cartoon, painting, CGI, 3D render, Octane, Unreal Engine, synthetic AI-art look, waxy plastic skin, beauty-filter smoothing, professionally retouched, ultra-detailed 8k, photorealistic commercial product shot, malformed hands, extra fingers, fused fingers, uncanny faces, duplicate limbs, generic stock-photo staging, sterile catalog packshot, studio cyclorama, beauty dish, oversaturated colors, inaccurate beer color, plastic-looking foam, perfectly dome-shaped fake foam, sticker-like condensation droplets, uniform droplet grid, floating bottle, wrong bottle scale, melted glass, gibberish label text, warped typography, mirrored words, AI-glossy hyper-sharpening, unnatural HDR glow, warm amber AI glow washed over the entire frame, teal-and-orange cinematic color grade, model-perfect faces, flawless magazine-ad symmetry, airbrushed advertising perfection, everyone posing and smiling at the camera, staged toast performed for the camera, even flattering studio light on every face";

export function resolveBeerPhysics(bierstil: string): BeerPhysicsProfile {
  const key = bierstil.trim().toLowerCase().replace(/\s+/g, "_");
  return (
    BEER_PHYSICS[key] ?? {
      srm: "4–8",
      hex: "#E8B050",
      liquid: "authentic craft beer color with natural clarity and physically plausible translucency",
      foam: "natural white foam with irregular pores and believable retention, never stiff or plastic",
      carbonation: "natural carbonation bubbles with varied size and spacing",
    }
  );
}

export function buildBeerPhysicsFragment(bierstil: string, behaelter: NonNullable<HyperrealisticInput["behaelter"]>): string {
  const profile = resolveBeerPhysics(bierstil);
  const vessel =
    behaelter === "G"
      ? "poured beer in glass"
      : behaelter === "F"
        ? "visible beer liquid through bottle glass where applicable"
        : "poured beer in glass and bottle liquid color consistency";
  return [
    `LIQUID PHYSICS (${vessel}):`,
    `Color SRM ${profile.srm}, approx. hex ${profile.hex} — ${profile.liquid}.`,
    `Foam: ${profile.foam}.`,
    `Carbonation: ${profile.carbonation}.`,
    "Glass: ordinary real glass. Highlights come from this room (window, sky, lamps), not a studio HDRI. Reflections show the actual setting. Condensation only if the drink is cold — sparse, irregular, some droplets already slid.",
    "Condensation: fine irregular perspiration droplets with varied size and spacing slowly sliding down chilled glass — never uniform sticker dots.",
    "Avoid unnaturally stiff, plastic-looking, or perfectly symmetrical foam domes.",
  ].join(" ");
}

/**
 * gpt-image-2 liefert nur 3 reale Formate (1024x1024 / 1024x1536 / 1536x1024).
 * Wir versprechen dem Modell daher das tatsächlich gerenderte Format, nicht das
 * UI-Verhältnis (9:16 und 4:5 werden beide zu Hochformat 2:3).
 */
function aspectRatioFormatLabel(aspectRatio: HyperrealisticInput["aspectRatio"]): string {
  if (aspectRatio === "1:1") return "a square 1:1";
  if (aspectRatio === "16:9") return "a horizontal landscape (3:2)";
  return "a vertical portrait (2:3)";
}

export function buildCameraFragment(
  shotType: NonNullable<HyperrealisticInput["shotType"]> | undefined,
  aspectRatio: HyperrealisticInput["aspectRatio"],
): string {
  const shot = shotType ?? "A";
  return `${CAMERA_BY_SHOT[shot]}. Kodak Portra 400 color, ISO 400, fine analog grain. Final composition framed for ${aspectRatioFormatLabel(aspectRatio)} format. Neutral white balance, slightly muted real-world color — no Instagram filter, no HDR.`;
}

export function buildSceneTextureAnchors(szene: HyperrealisticInput["szene"]): string {
  return `SCENE TEXTURE ANCHORS (mandatory micro-realism): ${SCENE_TEXTURE_ANCHORS[szene]}.`;
}

export function buildHumanRealismFragment(input: HyperrealisticInput): string {
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus === "A") return "";
  if (modus === "B" || modus === "C") {
    return "HUMAN REALISM: Real adult hands — visible knuckles, pores, veins, slight dryness or tan lines, correct finger count, believable grip pressure on glass and bottle. Not smooth CGI hands, not beauty-retouched skin.";
  }
  return [
    "HUMAN REALISM:",
    "Clearly adult humans with natural anatomy, realistic proportions, and true skin detail (pores, subtle blemishes, under-eye texture, realistic lips and ears).",
    "Faces must be artifact-free: no extra fingers, no fused fingers, no warped teeth, no uncanny asymmetry, no beauty-filter smoothing.",
    "Wardrobe and hair should look worn-in and candid, not catalog-styled. Expressions spontaneous, not posed stock-photo smiles.",
    "Keep person scale physically plausible relative to bottle, glass, table, and environment.",
  ].join(" ");
}

/** Eindeutiger Marker, damit der Lock nicht doppelt angehängt wird. */
export const BOTTLE_SHAPE_LOCK_MARKER = "BOTTLE SHAPE LOCK (MANDATORY)";

const FLASCHENFARBE_TEXT: Record<HyperrealisticInput["flaschenfarbe"], string> = {
  braun: "amber-brown glass",
  gruen: "green glass",
  klar: "clear flint glass",
};

/**
 * Erzwingt exakt den vom Nutzer gewählten Flaschentyp (Form + Volumen) und
 * verbietet typische Verwechslungen (z. B. NRW-0,5-l vs. Stubbi-0,33-l).
 * Wird bewusst spät im Prompt platziert, da gpt-image-2 spätere Anweisungen
 * stärker gewichtet — und überlebt so auch den Claude-Rewrite.
 */
export function buildBottleShapeLockFragment(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "G") return "";
  const flasche = FLASCHEN_TYPEN[input.flaschenTyp];
  if (!flasche) return "";
  const istDose = isDoseTyp(input.flaschenTyp);
  const noun = istDose ? "aluminium beverage can" : "bottle";
  const nounCap = istDose ? "Can" : "Bottle";
  const colorClause = istDose ? "" : `, made of ${FLASCHENFARBE_TEXT[input.flaschenfarbe]}`;
  return [
    `${BOTTLE_SHAPE_LOCK_MARKER}:`,
    `The ${noun} MUST be ${flasche.promptDescription}${colorClause}.`,
    `${nounCap} shape and size are defined by this specification — ${flasche.forbidden}.`,
    `If a bottle-shape reference photo is attached, copy that silhouette, neck length, shoulder and proportions exactly.`,
    `Label/artwork photos only supply printed graphics to apply onto this ${noun} — they must not replace the ${noun} with a different type.`,
    `Render the ${noun} at physically correct real-world scale so its size class (0.33 L vs 0.5 L) is unmistakable.`,
  ].join(" ");
}

const GLASS_FORBIDDEN: Record<NonNullable<HyperrealisticInput["glasTyp"]>, string> = {
  willibecher:
    "NOT a stemmed Pilsner flute or tulip, NOT a curvy Weizen vase, NOT a Maßkrug with handle, NOT a Teku, NOT a Stange",
  pils_tulpe: "NOT a stemless Willibecher tumbler, NOT a Weizen vase, NOT a Maßkrug, NOT a Teku",
  weizen: "NOT a Willibecher tumbler, NOT a stemmed Pilsner flute, NOT a Maßkrug, NOT a Stange",
  masskrug: "NOT a Willibecher, NOT a Pilsner flute, NOT a Weizen vase, NOT a stemless tumbler without handle",
  ipa_teku: "NOT a Willibecher, NOT a Weizen vase, NOT a Maßkrug, NOT a Pilsner flute",
  schwenker: "NOT a Willibecher, NOT a Weizen vase, NOT a Maßkrug, NOT a Pilsner flute",
  stange: "NOT a Willibecher (too wide), NOT a Pilsner flute, NOT a Weizen vase, NOT a Maßkrug",
};

/** Marker, damit der Etikett-Lock nicht doppelt angehängt wird. */
export const LABEL_LOCK_MARKER = "LABEL LOCK 1:1 (MANDATORY)";

export function buildLabelLockFragment(input: HyperrealisticInput): string {
  if ((input.etikettModus ?? "marke") !== "marke") return "";
  const product = input.beerName?.trim();
  const noun = isDoseTyp(input.flaschenTyp) ? "can" : "bottle";
  return [
    `${LABEL_LOCK_MARKER}:`,
    product ? `The attached reference photo IS the product "${product}".` : "The attached reference photo IS this exact product.",
    `Copy the printed ${noun} artwork 1:1 — same logo, same crest, same typography, same colors, same layout, same words.`,
    "Do not redesign, restyle, recolor, translate, abbreviate, or invent a variant (no new names, no extra badges, no swapped colorways).",
    "Every letter that is readable on the reference must appear the same on the generated label.",
    "The result is a new photograph of that same physical product in a new scene — not a collage and not a different beer.",
  ].join(" ");
}
export const GLASS_SHAPE_LOCK_MARKER = "GLASS SHAPE LOCK (MANDATORY)";

export function buildGlassShapeLockFragment(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "F" || !input.glasTyp) return "";
  const glas = GLAS_TYPEN[input.glasTyp];
  if (!glas) return "";
  const fillMl = pouredGlassFillMl(input.glasTyp, input.flaschenTyp, behaelter);
  const pour = glassPourPromptDescription(input.glasTyp, fillMl);
  const bottleMl = flascheVolumeMl(input.flaschenTyp);
  const volumeLock =
    behaelter === "B"
      ? `POUR VOLUME: the glass is a single pour from this ${bottleMl / 1000} L bottle/can (${fillMl} ml). It must look like it was filled from that one container — never a larger mug.`
      : "";
  return [
    `${GLASS_SHAPE_LOCK_MARKER}:`,
    `Every beer glass in frame MUST be ${pour}.`,
    `${GLASS_FORBIDDEN[input.glasTyp]}.`,
    volumeLock,
    "Do not substitute a different glass type.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Marker, damit die Verschluss-Logik nicht doppelt angehängt wird. */
export const CLOSURE_LOGIC_MARKER = "CLOSURE LOGIC (MANDATORY)";

/**
 * Physikalische Konsistenz des Verschlusses:
 * - Steht ein bereits eingeschenktes Glas daneben, ODER trinkt jemand aus der
 *   Flasche/Dose, MUSS das Gebinde geöffnet sein (kein Kronkorken / Tab offen).
 * - Eine versiegelte Flasche neben einem vollen Glas oder jemand, der aus einer
 *   verschlossenen Flasche trinkt, ist unlogisch und wird verboten.
 */
export function buildClosureLogicFragment(input: HyperrealisticInput): string {
  const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
  if (behaelter === "G") return "";
  const istDose = isDoseTyp(input.flaschenTyp);
  const istBuegel = input.flaschenTyp.startsWith("buegel");
  const noun = istDose ? "can" : "bottle";
  const closureWord = istDose
    ? "stay-tab still unopened"
    : istBuegel
      ? "swing-top porcelain stopper still clamped shut"
      : "crown cap still on the mouth";
  const openState = istDose
    ? "the stay-tab popped open at the top of the can"
    : istBuegel
      ? "the swing-top closure OPEN with the porcelain/ceramic stopper and its metal wire bail neatly flipped back and resting tidily against the bottle neck (clean, natural, intact mechanism — NOT dangling messily, NOT tangled, NOT floating in mid-air, NOT covering the label)"
      : "the crown cap removed — no cap on the bottle mouth";

  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const pluralNoun = istDose ? "cans" : "bottles";
  const lines: string[] = [`${CLOSURE_LOGIC_MARKER}, physical drinking consistency:`];

  // Glas eingeschenkt + Flasche → Gebinde wurde bereits geöffnet.
  if (behaelter === "B") {
    lines.push(
      `The adjacent beer glass is already poured, therefore the ${noun} MUST be shown ALREADY OPENED with ${openState} (someone has clearly opened it to pour). Never show a sealed ${noun} (${closureWord}) standing next to a full poured glass.`,
    );
  }

  // Gruppe, die anstößt/prostet → alle hochgehaltenen Gebinde sind offen.
  if (modus === "E") {
    lines.push(
      `When people raise, clink or toast (Anstoßen / Prost / cheers) the ${pluralNoun} together, EVERY raised and clinked ${noun} MUST be OPEN — show ${openState}. Toasting or clinking with sealed, unopened ${pluralNoun} (${closureWord}) is physically wrong and FORBIDDEN.`,
    );
  }

  lines.push(
    `If a person is drinking from, lifting, raising, clinking or toasting the ${noun} toward their lips or with others, the ${noun} MUST already be OPEN — show ${openState}. Drinking from, or toasting/clinking with, a still-sealed ${noun} (${closureWord}) is physically impossible and FORBIDDEN.`,
    `Only show a fully sealed/closed ${noun} for an untouched unopened product shot where nobody is drinking, raising or clinking and no poured glass is present.`,
  );

  return lines.join(" ");
}

export function buildHyperrealismLockFragment(): string {
  return [
    "HYPERREALISM LOCK:",
    "Output must look like an unretouched photograph from a real camera on location — a brewery snapshot, not a CGI product viz and not a retouched ad.",
    "Enforce physically plausible lighting, real material response, true-to-life reflections, natural shadow penumbra, and subtle real-world imperfections.",
    "Include at least three concrete environmental micro-details and believable surface wear — avoid sterile CGI smoothness.",
    "Do not describe this as photorealistic, ultra-detailed, high-fidelity, or professionally retouched — those words produce the AI-ad look.",
    "Strictly forbid illustration, cartoon, painting, CGI, 3D render, or stylized AI-art aesthetics.",
  ].join(" ");
}

/** Eindeutiger Marker, damit der Authentizitaets-Block nicht doppelt angehaengt wird. */
export const AUTHENTICITY_MARKER = "ANTI-AI AUTHENTICITY (MANDATORY)";

/**
 * Gegen den typischen "KI-Werbebild"-Look: Der Block zwingt das Modell in eine
 * dokumentarisch-editoriale Aesthetik (Reportage statt Hochglanz-Render).
 * Wird bewusst spaet im Prompt platziert — gpt-image-2 gewichtet spaete
 * Anweisungen staerker, und der Block ueberlebt so den Claude-Rewrite.
 */
export function buildAuthenticityFragment(input: HyperrealisticInput): string {
  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  const lines = [
    `${AUTHENTICITY_MARKER}:`,
    "This must read as a candid documentary photograph of a real moment — NOT a polished advertising render.",
    "Aesthetic: handheld editorial snapshot; slightly imperfect, lived-in, ordinary.",
    "Color science of Kodak Portra 400. Fine analog grain. Neutral white balance, slightly muted real-world color — never a warm amber glow over the whole frame, never teal-orange grading, never HDR, never beauty-retouch.",
    "Lighting is a large soft source from the actual scene (sun, overcast sky, window, practical lamps) with true falloff. Some areas stay in shadow. Highlights may clip softly. No beauty dish, no rim-light hero glow.",
    "The product rests on a real surface with a natural contact shadow. Glass reflects this room, not a white studio cove.",
    "Composition is slightly off: not centered, natural overlaps, things cropped at the frame edge. Not everything is razor-sharp.",
  ];
  if (modus === "B" || modus === "C") {
    lines.push(
      "Visible hands are real adult hands: knuckles, pores, veins, slightly imperfect skin, a firm believable grip — not smooth CGI, not beauty-retouched.",
    );
  }
  if (modus === "D" || modus === "E") {
    lines.push(
      "The people are ordinary real people, not models: uneven skin with visible pores, stray hairs, natural imperfect teeth, asymmetric mid-moment expressions, relaxed unposed body language. They are absorbed in their own moment — nobody performs or poses for the camera unless the brief explicitly asks for it.",
    );
  }
  return lines.join(" ");
}

export function ensureHyperrealismDirectives(prompt: string, input: HyperrealisticInput): string {
  let next = prompt.trim();
  const lower = next.toLowerCase();

  if (!/high-fidelity photorealistic|hyperrealism lock|indistinguishable from a real camera/i.test(lower)) {
    next = `${buildHyperrealismLockFragment()}\n\n${next}`;
  }

  if (!/liquid physics|srm \d|approx\. hex/i.test(lower)) {
    const behaelter = input.behaelter ?? (input.glasTyp ? "B" : "F");
    next = `${next}\n\n${buildBeerPhysicsFragment(input.bierstil, behaelter)}`;
  }

  if (!/scene texture anchors|micro-realism/i.test(lower)) {
    next = `${next}\n\n${buildSceneTextureAnchors(input.szene)}`;
  }

  const modus = input.personenModus ?? (input.personImBild ? "D" : "A");
  if (modus !== "A" && !/human realism|waxy plastic skin|artifact-free/i.test(lower)) {
    next = `${next}\n\n${buildHumanRealismFragment(input)}`;
  }

  if (!/shot on.*full-frame|canon eos|35mm|50mm|85mm|100mm/i.test(lower)) {
    next = `${next}\n\nCAMERA: ${buildCameraFragment(input.shotType, input.aspectRatio)}`;
  }

  if (!/cgi|3d render|plastic-looking foam|waxy plastic skin/i.test(lower.slice(-600))) {
    next = `${next}\n\nNEGATIVE (hyperreal): ${HYPERREALISM_NEGATIVE}`;
  }

  if (!next.includes(GLASS_SHAPE_LOCK_MARKER)) {
    const glassLock = buildGlassShapeLockFragment(input);
    if (glassLock) next = `${next}\n\n${glassLock}`;
  }

  // Immer spaet anhaengen: dokumentarische Authentizitaet gegen den KI-Werbe-Look.
  if (!next.includes(AUTHENTICITY_MARKER)) {
    next = `${next}\n\n${buildAuthenticityFragment(input)}`;
  }

  if (!next.includes(LABEL_LOCK_MARKER)) {
    const labelLock = buildLabelLockFragment(input);
    if (labelLock) next = `${next}\n\n${labelLock}`;
  }

  return next.trim();
}
