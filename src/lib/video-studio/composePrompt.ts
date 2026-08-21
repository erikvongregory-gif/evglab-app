import {
  findHook,
  findPresetLabel,
  findSetting,
  type VideoStudioBrief,
} from "@/lib/video-studio/options";

const PRESET_FRAMING: Record<string, string> = {
  ugc: "Handheld selfie-style POV, slightly imperfect framing at eye-level, direct casual address",
  tutorial: "Stable tripod demonstration angle, instructional step-by-step pacing",
  unboxing: "Top-down or three-quarter angle, hands visible, product central, slow reveal energy",
  review: "Medium eye-level shot, analytical mood, deliberate pacing",
  tv_spot: "Cinematic wide-to-close composition with story-arc pacing",
  wild_card: "Experimental framing that fits the concept, bold visual energy",
};

const PRESET_CAMERA: Record<string, string> = {
  ugc: "handheld selfie camera with slight natural shake",
  tutorial: "stable tripod shot with clear demonstration angle",
  review: "steady medium shot with shallow depth of field",
  tv_spot: "cinematic multi-angle implied movement",
  unboxing: "overhead or three-quarter product-focused camera",
  wild_card: "creative camera movement matching the concept",
};

const SPEAKER_LINES: Record<string, string> = {
  brauer: "A mid-30s male brewmaster in a worn dark canvas work shirt, light beard, calm confident demeanor",
  sommelier: "A 40s beer sommelier in a clean blazer, deliberate movements, analytical eyes",
  endkunde: "A casual 25-year-old in everyday clothes, warm authentic energy, slight smile",
  pov: "First-person perspective, only hands visible holding the glass",
};

const SPEAKER_ACTION: Record<string, string> = {
  ugc: "speaks directly to camera in conversational German",
  tutorial: "demonstrates and explains each step clearly in German",
  unboxing: "reacts with building excitement while revealing the product",
  review: "analyzes aroma, appearance, and taste in descriptor-heavy German",
  tv_spot: "delivers a minimal brand line with cinematic presence",
  wild_card: "continues the story beat that matches the experimental concept",
};

function inferGlassType(productLabel: string): string {
  const lower = productLabel.toLowerCase();
  if (lower.includes("weizen")) return "tall curved Weizen glass";
  if (lower.includes("pils")) return "tall slender Pilsner flute";
  if (lower.includes("ipa") || lower.includes("pale ale")) return "nonic pint glass";
  if (lower.includes("stout") || lower.includes("porter")) return "tulip snifter glass";
  if (lower.includes("kölsch") || lower.includes("koelsch")) return "slim cylindrical Kölsch Stange glass";
  if (lower.includes("bock") || lower.includes("märzen") || lower.includes("maerzen")) return "Bavarian stein or pokal";
  if (lower.includes("belg")) return "wide chalice goblet";
  return "traditional Willibecher glass";
}

function splitProductLabel(productLabel: string): { beerType: string; brewery: string } {
  const parts = productLabel.split(/[—–\-:|]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { beerType: parts[0], brewery: parts.slice(1).join(" ") };
  }
  return { beerType: productLabel.trim() || "craft beer", brewery: "the brewery brand" };
}

export type ComposedVideoPrompt = {
  configurationLines: string[];
  englishPrompt: string;
  audioHint: string;
  workflowHint: string[];
};

export function composeVideoPrompt(brief: VideoStudioBrief): ComposedVideoPrompt | null {
  if (
    !brief.presetId ||
    !brief.hookId ||
    !brief.settingId ||
    !brief.productLabel ||
    !brief.speakerId ||
    !brief.aspectRatioId
  ) {
    return null;
  }

  const hook = findHook(brief.hookId);
  const setting = findSetting(brief.settingId);
  if (!hook || !setting) return null;

  const presetFraming = PRESET_FRAMING[brief.presetId] ?? PRESET_FRAMING.ugc;
  const presetCamera = PRESET_CAMERA[brief.presetId] ?? PRESET_CAMERA.ugc;
  const speakerDesc = SPEAKER_LINES[brief.speakerId] ?? SPEAKER_LINES.brauer;
  const speakerAction = SPEAKER_ACTION[brief.presetId] ?? SPEAKER_ACTION.ugc;
  const { beerType, brewery } = splitProductLabel(brief.productLabel);
  const glassType = inferGlassType(brief.productLabel);

  const englishPrompt = [
    `${presetFraming}.`,
    `${hook.promptSnippet}`,
    `The setting: ${setting.promptSnippet}`,
    `${speakerDesc} holds ${beerType} in a ${glassType}, with "${brewery}" label visible on the bottle.`,
    `${speakerDesc.split(".")[0]} then ${speakerAction}.`,
    `Camera: ${presetCamera}.`,
    `Aspect ratio ${brief.aspectRatioId}, shot with natural realistic lighting consistent with the setting.`,
  ].join(" ");

  const hookLabel = hook.label;
  const settingLabel = setting.label;

  return {
    configurationLines: [
      `Preset: ${findPresetLabel(brief.presetId)} | Hook: ${hookLabel} (${hook.type})`,
      `Setting: ${settingLabel} (${setting.type}) | Produkt: ${brief.productLabel}`,
      `Sprecher: ${brief.speakerId} | Modell: Seedance 2`,
      `Aspect Ratio: ${brief.aspectRatioId}`,
    ],
    englishPrompt,
    audioHint:
      "Audio optional: Seedance 2 generiert ohne Audio (günstiger). Voiceover separat mit ElevenLabs möglich.",
    workflowHint: [
      "Video direkt in BrewAI mit Seedance 2 generieren",
      "Etikett-Asset als reference_image_urls in späteren Versionen",
      "Optional: Soul Character für wiederkehrenden Sprecher",
      "Upscaling mit Topaz Video AI für 4K-Final",
    ],
  };
}

export function buildPromptSegments(brief: VideoStudioBrief): { text: string; highlight?: boolean }[] {
  const segments: { text: string; highlight?: boolean }[] = [];
  if (brief.initialBrief) segments.push({ text: brief.initialBrief });
  if (brief.presetId) segments.push({ text: findPresetLabel(brief.presetId), highlight: true });
  if (brief.hookId) {
    const hook = findHook(brief.hookId);
    if (hook) segments.push({ text: hook.label, highlight: true });
  }
  if (brief.settingId) {
    const setting = findSetting(brief.settingId);
    if (setting) segments.push({ text: setting.label, highlight: true });
  }
  if (brief.productLabel) segments.push({ text: brief.productLabel, highlight: true });
  if (brief.speakerId) {
    const speaker = brief.speakerId;
    segments.push({ text: speaker.charAt(0).toUpperCase() + speaker.slice(1), highlight: true });
  }
  if (brief.aspectRatioId) segments.push({ text: brief.aspectRatioId, highlight: true });
  return segments;
}
