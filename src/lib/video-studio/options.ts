export type VideoPresetId = "ugc" | "tutorial" | "unboxing" | "review" | "tv_spot" | "wild_card";
export type HookTypeId = "stunt" | "subtle";
export type SettingTypeId = "realistic" | "unrealistic";
export type SpeakerId = "brauer" | "sommelier" | "endkunde" | "pov";
export type PlatformId = "kling_3" | "veo_3_1" | "seedance_2" | "hyper_motion";
export type AspectRatioId = "9:16" | "1:1" | "16:9";

export type VideoStudioChoice = {
  id: string;
  label: string;
  hint?: string;
  badge?: string;
};

export type HookOption = VideoStudioChoice & {
  type: HookTypeId;
  promptSnippet: string;
};

export type SettingOption = VideoStudioChoice & {
  type: SettingTypeId;
  promptSnippet: string;
};

export const VIDEO_PRESET_OPTIONS: VideoStudioChoice[] = [
  { id: "ugc", label: "UGC", hint: "Authentischer Selfie-POV" },
  { id: "tutorial", label: "Tutorial", hint: "Schritt-für-Schritt Erklärung" },
  { id: "unboxing", label: "Unboxing", hint: "Geschenk-Set, Limited Edition" },
  { id: "review", label: "Product Review", hint: "Sommelier-/Review-Stil" },
  { id: "tv_spot", label: "TV Spot", hint: "Klassische Markenwerbung" },
  { id: "wild_card", label: "Wild Card", hint: "Experimentell / Custom" },
];

export const HOOK_TYPE_OPTIONS: VideoStudioChoice[] = [
  { id: "stunt", label: "Stunt", hint: "Laut, extrem, Pattern Interrupt" },
  { id: "subtle", label: "Subtle", hint: "Sanfte Überraschung" },
];

export const HOOK_OPTIONS: HookOption[] = [
  { id: "hopfen_explosion", type: "stunt", label: "Hopfen-Explosion", promptSnippet: "Hop cones suddenly cascade from above onto the subject's head, they brush them off without breaking eye contact, then pivot to introduce the beer." },
  { id: "bier_tsunami", type: "stunt", label: "Bier-Tsunami", promptSnippet: "A massive wave of golden beer rolls toward the subject from off-frame; instead of flinching, they calmly take a sip from a held glass as the wave passes." },
  { id: "glas_crash", type: "stunt", label: "Glas-Crash", promptSnippet: "A beer glass shatters dramatically on the floor; in the next frame a perfectly intact filled glass is in the subject's hand and they begin reviewing as if nothing happened." },
  { id: "schaum_splash", type: "stunt", label: "Schaum-Splash", promptSnippet: "Beer foam explodes into the subject's face from a popped bottle; they wipe it off slowly, smile, and begin speaking about the beer." },
  { id: "anstich_boom", type: "stunt", label: "Anstich-Boom", promptSnippet: "An oversized wooden mallet swings down into frame, striking a wooden keg tap with explosive force; beer geysers out, then settles, subject calmly fills a glass." },
  { id: "hopfenregen", type: "stunt", label: "Hopfenregen", promptSnippet: "Fresh hop cones rain down from the ceiling like confetti; subject catches one mid-air, sniffs it appreciatively, then holds up the bottle." },
  { id: "flaschen_wand", type: "stunt", label: "Flaschen-Wand", promptSnippet: "A wall of empty bottles topples toward the subject in slow motion; they sidestep gracefully, grab one upright bottle, and begin pouring." },
  { id: "buegel_pop", type: "stunt", label: "Bügelverschluss-Pop", promptSnippet: "Extreme close-up: a swing-top bottle cap pops open with explosive force, camera zooms out to reveal subject holding the bottle, immediately pours." },
  { id: "sommelier_pov", type: "subtle", label: "Sommelier-POV", promptSnippet: "First-person view: subject lifts a beer glass toward the nose, closes their eyes briefly, inhales deeply, opens eyes with a satisfied half-smile, then begins to speak." },
  { id: "brauer_reveal", type: "subtle", label: "Brauer-Reveal", promptSnippet: "Subject stands silhouetted against a copper brewing kettle, slowly turns to camera while holding a full glass at chest height, then begins reviewing." },
  { id: "stilles_anstossen", type: "subtle", label: "Stilles Anstoßen", promptSnippet: "Two beer glasses clink together in slow motion at center frame; camera pulls back to reveal one of the drinkers, who begins speaking directly to camera." },
  { id: "schaum_pull", type: "subtle", label: "Schaum-Pull", promptSnippet: "Extreme macro close-up of dense beer foam, slow pull-back reveals the glass, then the hand holding it, then the subject's face, who immediately begins the pitch." },
  { id: "etikett_stroke", type: "subtle", label: "Etikett-Stroke", promptSnippet: "A finger traces slowly across a beer bottle label in macro detail, then the camera tilts up to the subject's face who makes eye contact and starts speaking." },
  { id: "bottle_spin", type: "subtle", label: "Bottle-Spin", promptSnippet: "A beer bottle spins on a wooden bar surface, gradually slowing until the label faces the camera; a hand enters frame, grabs it, and the subject begins to review." },
  { id: "einchenk_pov", type: "subtle", label: "Einschenk-POV", promptSnippet: "First-person perspective of pouring beer from a bottle into a glass on a counter; the filled glass is then lifted toward the camera, and a voiceover begins." },
  { id: "reflexions_reveal", type: "subtle", label: "Reflexions-Reveal", promptSnippet: "The subject's face is visible only as a reflection on the curved bottle surface; camera pulls focus to reveal the actual person behind, who begins speaking." },
];

export const SETTING_TYPE_OPTIONS: VideoStudioChoice[] = [
  { id: "realistic", label: "Realistisch", hint: "Authentische Brauerei-Locations" },
  { id: "unrealistic", label: "Surreal", hint: "Oversized / unreal für Aufmerksamkeit" },
];

export const SETTING_OPTIONS: SettingOption[] = [
  { id: "sudhaus", type: "realistic", label: "Sudhaus", promptSnippet: "Inside a working brewhouse with gleaming copper kettles and stainless steel vessels, soft industrial pendant lighting, faint steam drifting through the air, warm metallic reflections, cozy yet professional." },
  { id: "lagerkeller", type: "realistic", label: "Lagerkeller", promptSnippet: "Dim cellar with rows of wooden barrels stacked on iron racks, single warm tungsten lamp, cool damp atmosphere, slight haze, intimate craftsmanship vibe." },
  { id: "schankraum", type: "realistic", label: "Schankraum", promptSnippet: "Traditional pub interior with dark wooden bar counter, brass taps in a row, warm pendant lights, leather barstools, evening golden tone, lived-in coziness." },
  { id: "biergarten", type: "realistic", label: "Biergarten", promptSnippet: "Outdoor wooden bench tables under massive chestnut trees, dappled afternoon sunlight, gravel ground, distant chatter, summer evening warmth." },
  { id: "brauerei_hof", type: "realistic", label: "Brauerei-Hof", promptSnippet: "Old brewery courtyard with cobblestones, wrought iron sign reading the brewery name, ivy-covered brick walls, golden hour side light." },
  { id: "hopfenfeld", type: "realistic", label: "Hopfenfeld", promptSnippet: "Tall hop vines climbing wooden trellises forming green corridors, soft morning mist between rows, fresh green tones, earthy ground." },
  { id: "gerstenfeld", type: "realistic", label: "Gerstenfeld", promptSnippet: "Golden barley field at sunset, wind moving grain in waves, warm low light, lens flare across the frame, pastoral wide-open feel." },
  { id: "tasting_room", type: "realistic", label: "Tasting Room", promptSnippet: "Modern minimalist tasting space with light oak tables, neutral grey walls, soft north-facing window light, tasting glasses arranged precisely, contemplative atmosphere." },
  { id: "brauer_werkstatt", type: "realistic", label: "Brauer-Werkstatt", promptSnippet: "Workshop interior with malt sacks stacked along walls, brewing tools hung on pegboards, single industrial work lamp, sawdust and grain texture, hands-on tactile mood." },
  { id: "privatkeller", type: "realistic", label: "Privatkeller", promptSnippet: "Home bar with dark walnut shelves backlit by warm LED strips, curated bottle collection, vintage leather chair in foreground, intimate evening atmosphere." },
  { id: "stehausschank", type: "realistic", label: "Stehausschank", promptSnippet: "Concrete-floor standing pub at lunchtime, simple high tables, daylight from large windows, mid-day crowd energy, casual urban vibe." },
  { id: "im_glas", type: "unrealistic", label: "Im Glas schwimmend", promptSnippet: "Subject submerged in bubbling amber beer, looking up through a layer of dense white foam from below, golden sunlight refracting through the liquid, scale impossible." },
  { id: "riesen_buegel", type: "unrealistic", label: "Riesen-Bügelverschluss", promptSnippet: "Subject sits casually on top of a giant porcelain swing-top bottle cap as if it were a stool, legs dangling, beer bottle visible far below in soft focus." },
  { id: "hopfen_riese", type: "unrealistic", label: "Hopfen-Riese", promptSnippet: "Subject walks through a hop field as a giant, the hop vines reaching only knee-height, golden hour light, fantasy proportions, dream-like." },
  { id: "sudkessel_innen", type: "unrealistic", label: "Sudkessel-Innen", promptSnippet: "Subject stands inside a massive copper brewing kettle, looking up at the open rim, steam rising around them, warm copper reflections, no danger visible." },
  { id: "schaum_insel", type: "unrealistic", label: "Schaum-Insel", promptSnippet: "Subject relaxes on a floating island made entirely of dense beer foam in an ocean of golden beer, blue-sky horizon, surreal but calm." },
  { id: "hopfen_konfetti", type: "unrealistic", label: "Hopfen-Konfetti", promptSnippet: "Stadium-scale celebration setting with hop cones raining like confetti from above, subject standing at center holding a glass like a trophy, dramatic spotlights." },
  { id: "etikett_billboard", type: "unrealistic", label: "Etikett-Billboard", promptSnippet: "Subject walks across a giant horizontal beer label as if it were a city plaza, the label graphics stretching to the horizon, top-down dramatic perspective." },
  { id: "schaum_krater", type: "unrealistic", label: "Schaum-Krater", promptSnippet: "Subject stands at the bottom of a giant crater made of beer foam, looking up at the rim far above, soft diffused white light from above, otherworldly." },
];

export const SPEAKER_OPTIONS: VideoStudioChoice[] = [
  { id: "brauer", label: "Brauer", hint: "Mid-30s, Workshirt, ruhig & kompetent" },
  { id: "sommelier", label: "Sommelier", hint: "40s, professionell, analytisch" },
  { id: "endkunde", label: "Endkunde", hint: "20–30s, casual, authentisch" },
  { id: "pov", label: "POV", hint: "Keine Person — nur Hände sichtbar" },
];

export const PLATFORM_OPTIONS: VideoStudioChoice[] = [
  { id: "kling_3", label: "Kling 3.0", hint: "5–10s, starke Physik" },
  { id: "veo_3_1", label: "Veo 3.1", hint: "8s, natives Audio" },
  { id: "seedance_2", label: "Seedance 2.0", hint: "Multi-Shot Storytelling" },
  { id: "hyper_motion", label: "Hyper Motion", hint: "Hero-Product-Highlights" },
];

export const ASPECT_RATIO_OPTIONS: VideoStudioChoice[] = [
  { id: "9:16", label: "9:16", hint: "TikTok / Reels" },
  { id: "1:1", label: "1:1", hint: "Feed" },
  { id: "16:9", label: "16:9", hint: "YouTube / Landscape" },
];

export type VideoStudioBrief = {
  initialBrief: string;
  presetId?: VideoPresetId;
  hookTypeId?: HookTypeId;
  hookId?: string;
  settingTypeId?: SettingTypeId;
  settingId?: string;
  productLabel?: string;
  speakerId?: SpeakerId;
  platformId?: PlatformId;
  aspectRatioId?: AspectRatioId;
};

export type VideoStudioStepId =
  | "brief"
  | "preset"
  | "hook_type"
  | "hook"
  | "setting_type"
  | "setting"
  | "product"
  | "speaker"
  | "platform"
  | "aspect"
  | "result";

export function getStepMeta(step: VideoStudioStepId): { label: string; description: string; inputMode: "text" | "choice" } {
  switch (step) {
    case "brief":
      return {
        label: "Idee",
        description: "Beschreibe kurz, welches Video du willst — Stil, Stimmung, Ziel.",
        inputMode: "text",
      };
    case "preset":
      return {
        label: "Format",
        description: "Welches Video-Format passt am besten?",
        inputMode: "choice",
      };
    case "hook_type":
      return {
        label: "Hook-Typ",
        description: "Wie dramatisch soll der Einstieg in die ersten 3 Sekunden sein?",
        inputMode: "choice",
      };
    case "hook":
      return {
        label: "Hook",
        description: "Welcher Pattern Interrupt startet dein Video?",
        inputMode: "choice",
      };
    case "setting_type":
      return {
        label: "Setting-Typ",
        description: "Realistische Location oder surreal für mehr Aufmerksamkeit?",
        inputMode: "choice",
      };
    case "setting":
      return {
        label: "Setting",
        description: "Wo spielt das Video?",
        inputMode: "choice",
      };
    case "product":
      return {
        label: "Produkt",
        description: "Welches Bier und welche Brauerei? z. B. „Helles — Lüne Bräu Original“",
        inputMode: "text",
      };
    case "speaker":
      return {
        label: "Sprecher",
        description: "Wer spricht im Video?",
        inputMode: "choice",
      };
    case "platform":
      return {
        label: "Plattform",
        description: "Für welches KI-Video-Modell optimieren wir den Prompt?",
        inputMode: "choice",
      };
    case "aspect":
      return {
        label: "Format",
        description: "Welches Seitenverhältnis brauchst du?",
        inputMode: "choice",
      };
    case "result":
      return {
        label: "Fertig",
        description: "Dein kopierfertiger Video-Prompt steht bereit.",
        inputMode: "text",
      };
  }
}

export function choicesForStep(step: VideoStudioStepId, brief: VideoStudioBrief): VideoStudioChoice[] {
  switch (step) {
    case "preset":
      return VIDEO_PRESET_OPTIONS;
    case "hook_type":
      return HOOK_TYPE_OPTIONS;
    case "hook":
      return HOOK_OPTIONS.filter((h) => !brief.hookTypeId || h.type === brief.hookTypeId).map(({ id, label, hint, badge }) => ({
        id,
        label,
        hint,
        badge,
      }));
    case "setting_type":
      return SETTING_TYPE_OPTIONS;
    case "setting":
      return SETTING_OPTIONS.filter((s) => !brief.settingTypeId || s.type === brief.settingTypeId).map(({ id, label, hint, badge }) => ({
        id,
        label,
        hint,
        badge,
      }));
    case "speaker":
      return SPEAKER_OPTIONS;
    case "aspect":
      return ASPECT_RATIO_OPTIONS;
    default:
      return [];
  }
}

export function nextStep(current: VideoStudioStepId): VideoStudioStepId | null {
  const order: VideoStudioStepId[] = [
    "brief",
    "preset",
    "hook_type",
    "hook",
    "setting_type",
    "setting",
    "product",
    "speaker",
    "aspect",
    "result",
  ];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

export function findHook(id: string): HookOption | undefined {
  return HOOK_OPTIONS.find((h) => h.id === id);
}

export function findSetting(id: string): SettingOption | undefined {
  return SETTING_OPTIONS.find((s) => s.id === id);
}

export function findPresetLabel(id: VideoPresetId): string {
  return VIDEO_PRESET_OPTIONS.find((p) => p.id === id)?.label ?? id;
}
