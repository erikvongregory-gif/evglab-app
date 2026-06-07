import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicMessageWithModelFallback } from "@/lib/anthropic/modelCandidates";

export type BrandScanJson = {
  breweryName: string;
  brandTone: string;
  brandColors: string;
  brandDos: string;
  brandDonts: string;
};

export type BrandAnalysisImage = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

export function parseScanJson(raw: string): BrandScanJson | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const breweryName = typeof parsed.breweryName === "string" ? parsed.breweryName.trim() : "";
    const brandTone = typeof parsed.brandTone === "string" ? parsed.brandTone.trim() : "";
    const brandColors = typeof parsed.brandColors === "string" ? parsed.brandColors.trim() : "";
    const brandDos = typeof parsed.brandDos === "string" ? parsed.brandDos.trim() : "";
    const brandDonts = typeof parsed.brandDonts === "string" ? parsed.brandDonts.trim() : "";
    if (!breweryName || !brandTone || !brandColors || !brandDos || !brandDonts) return null;
    return { breweryName, brandTone, brandColors, brandDos, brandDonts };
  } catch {
    return null;
  }
}

function buildImageParts(images: BrandAnalysisImage[], maxImages = 6): Anthropic.Messages.ImageBlockParam[] {
  return images.slice(0, maxImages).map((image) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: image.mediaType,
      data: image.base64,
    },
  }));
}

const JSON_SCHEMA =
  '{"breweryName":"string","brandTone":"string","brandColors":"string","brandDos":"string","brandDonts":"string"}';

function buildInstagramSystemPrompt(): string {
  return [
    "Du bist eine Marken-Analystin fuer Brauereien und Getraenkemarken.",
    "Du siehst genau 5 Bilder — typischerweise Screenshots von Instagram-Posts derselben Marke.",
    "Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt (kein Fliesstext, keine Codefence). Schema:",
    JSON_SCHEMA,
    "Alle Textwerte auf Deutsch, knapp aber konkret (je 1-3 Saetze wo sinnvoll).",
    "breweryName: erkennbare Marken-/Brauereibezeichnung aus den Bildern.",
    "brandTone: Kommunikations- und Bildton (z.B. jung/traditionell/premium/verspielt).",
    "brandColors: dominante Farben, Kontraste, Lichtstimmung, typische Bildsprache.",
    "brandDos: was die KI bei neuen Motiven unbedingt beibehalten soll (Layout, Typo, Stilmerkmale).",
    "brandDonts: was vermieden werden soll (Stilbrueche, falsche Farbwelt, unpassende Stimmung).",
  ].join(" ");
}

function buildWebsiteSystemPrompt(): string {
  return [
    "Du bist eine Marken-Analystin fuer Brauereien und Getraenkemarken.",
    "Du erhaeltst Website-Texte und optional Bilder derselben Marke.",
    "Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt (kein Fliesstext, keine Codefence). Schema:",
    JSON_SCHEMA,
    "Alle Textwerte auf Deutsch, knapp aber konkret (je 1-3 Saetze wo sinnvoll).",
    "Analysiere Website-Texte fuer Tonality, Wortwahl, Zielgruppe, Regionalitaet, Craft vs. Tradition.",
    "Fuer die Bildanalyse NUR permanente Markenidentitaet nutzen: Bierflaschen, Etiketten, Glaeser, Produktfotos, Biergarten-/Genussmomente mit sichtbarem Markenlogo auf Glas oder Flasche.",
    "Social-Wall-Motive, Freunde mit Bier, Anstoßen und authentische Markenstimmung sind PREMIUM-Referenzen — nutze sie fuer Tonality und Bildsprache.",
    "IGNORIERE temporaere Kampagnen (WM, EM, Sport-Sponsoring, Events, Prominente, News-Banner) — die gehoeren NICHT zur dauerhaften Bildsprache.",
    "breweryName: erkennbare Marken-/Brauereibezeichnung.",
    "brandTone: 4-6 Stichworte, kommagetrennt (z.B. Bodenständig, Handwerklich, Warm, Regional).",
    "brandColors: genau 5 Hex-Farbcodes der Markenpalette, kommagetrennt (z.B. #E8772E, #6B4423) — aus Etikett/Logo/Produktfotos, keine Event-Kampagnenfarben.",
    "brandDos: zwei kurze Saetze — erster fuer Bildlicht, zweiter fuer Komposition/Produktanordnung.",
    "brandDonts: was vermieden werden soll — explizit temporaere Kampagnenoptik, Sport-Event-Banner, fremde Event-Farben.",
  ].join(" ");
}

const IMAGE_SELECTION_SCHEMA = '{"selectedIndices":[0,2],"rejectedReason":"kurz auf Deutsch"}';

function parseImageSelectionJson(raw: string, maxIndex: number): number[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { selectedIndices?: unknown };
    if (!Array.isArray(parsed.selectedIndices)) return [];
    return parsed.selectedIndices
      .filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= maxIndex)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** Vision-Vorauswahl: nur Bier-/Produktmotive, keine Kampagnen-Banner. */
export async function selectBeerProductImageIndices(params: {
  apiKey: string;
  images: BrandAnalysisImage[];
  imageHints?: Array<{ alt: string; url: string }>;
}): Promise<number[]> {
  if (params.images.length === 0) return [];

  const anthropic = new Anthropic({ apiKey: params.apiKey });
  const hints = params.imageHints
    ?.map((hint, index) => `Bild ${index}: alt="${hint.alt || "—"}" url=${hint.url}`)
    .join("\n");

  const system = [
    "Du filterst Website-Bilder einer Brauerei fuer ein dauerhaftes Markenprofil.",
    "BEVORZUGE (hoechste Prioritaet):",
    "- Lifestyle-/Genussmotive: Menschen mit markenbeschriftetem Bierglas, Anstoßen, Biergarten, Terrasse, authentische Markenstimmung",
    "- Social-Wall-Collagen und Moodboards mit mehreren Bierszenen (auch als ein Bild)",
    "- Produktfotos: Flaschen, Dosen, Etiketten, Gläser, Sortiment",
    "LEHNE AB: WM/EM/Sport-Kampagnen, Event-Banner, Sponsoring-Key-Visuals ohne Produkt, reine Prominente ohne Bier, News-Teaser.",
    "WICHTIG: Ein Social-Wall-Mosaik mit mehreren Bierszenen ist SEHR wertvoll — waehle es mit, auch wenn es ein Collage-Bild ist.",
    "Antworte AUSSCHLIESSLICH mit JSON (keine Codefence):",
    IMAGE_SELECTION_SCHEMA,
    "selectedIndices: 0-basierte Indizes der passenden Bilder, max 5, sortiert nach Relevanz.",
    "Wenn kein Bild passt: {\"selectedIndices\":[],\"rejectedReason\":\"...\"}.",
  ].join(" ");

  const userText = [
    `Es liegen ${params.images.length} Website-Bilder vor (Index 0 bis ${params.images.length - 1}).`,
    hints ? `\nHTML-Hinweise:\n${hints}` : "",
    "\nWaehle dauerhafte Marken-Referenzen: Produkt UND/ODER authentische Genuss-/Social-Motive mit sichtbarem Bier der Marke.",
  ].join("\n");

  const imageParts = buildImageParts(params.images, 12);

  try {
    const response = await createAnthropicMessageWithModelFallback(anthropic, {
      max_tokens: 300,
      temperature: 0.1,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: userText }, ...imageParts] }],
    });
    const textBlock = response.content.find((item) => item.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return parseImageSelectionJson(raw, params.images.length - 1);
  } catch {
    return [];
  }
}

async function runClaudeAnalysis(params: {
  apiKey: string;
  system: string;
  userText: string;
  images: BrandAnalysisImage[];
  temperature: number;
}): Promise<BrandScanJson> {
  const anthropic = new Anthropic({ apiKey: params.apiKey });
  const imageParts = buildImageParts(params.images);

  const response = await createAnthropicMessageWithModelFallback(anthropic, {
    max_tokens: 1200,
    temperature: params.temperature,
    system: params.system,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: params.userText }, ...imageParts],
      },
    ],
  });

  const textBlock = response.content.find((item) => item.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
  const scan = parseScanJson(raw);
  if (!scan) {
    throw new Error("KI-Auswertung konnte nicht strukturiert gelesen werden.");
  }
  return scan;
}

export async function analyzeInstagramPosts(params: {
  apiKey: string;
  images: BrandAnalysisImage[];
  instagramUrl?: string;
}): Promise<BrandScanJson> {
  const userText = params.instagramUrl
    ? `Zusaetzlicher Hinweis — Instagram-Profil-URL der Marke (falls passend): ${params.instagramUrl}`
    : "Keine zusaetzliche Instagram-URL angegeben — leite alles aus den 5 Bildern ab.";

  try {
    return await runClaudeAnalysis({
      apiKey: params.apiKey,
      system: buildInstagramSystemPrompt(),
      userText,
      images: params.images,
      temperature: 0.3,
    });
  } catch (firstError) {
    try {
      return await runClaudeAnalysis({
        apiKey: params.apiKey,
        system: buildInstagramSystemPrompt(),
        userText,
        images: params.images,
        temperature: 0.1,
      });
    } catch {
      throw firstError;
    }
  }
}

export async function analyzeWebsiteBrand(params: {
  apiKey: string;
  websiteUrl: string;
  textExcerpt: string;
  images: BrandAnalysisImage[];
}): Promise<BrandScanJson> {
  const userText = [
    `Website-URL: ${params.websiteUrl}`,
    "",
    "Extrahierte Website-Texte:",
    params.textExcerpt || "(Keine Texte gefunden — leite soweit moeglich aus Bildern ab.)",
    params.images.length
      ? `\nEs wurden ${params.images.length} Bier-/Produkt-Referenzbilder mitgeliefert (bereits gefiltert, keine Kampagnen-Banner).`
      : "\nKeine passenden Produktbilder verfuegbar — analysiere primaer anhand der Website-Texte.",
  ].join("\n");

  try {
    return await runClaudeAnalysis({
      apiKey: params.apiKey,
      system: buildWebsiteSystemPrompt(),
      userText,
      images: params.images,
      temperature: 0.3,
    });
  } catch (firstError) {
    try {
      return await runClaudeAnalysis({
        apiKey: params.apiKey,
        system: buildWebsiteSystemPrompt(),
        userText,
        images: params.images,
        temperature: 0.1,
      });
    } catch {
      throw firstError;
    }
  }
}

export function computeAnalysisConfidence(params: {
  textExcerpt: string;
  imageCount: number;
}): "high" | "medium" | "low" {
  const textLen = params.textExcerpt.trim().length;
  if (textLen >= 400 && params.imageCount >= 2) return "high";
  if (textLen >= 120 || params.imageCount >= 1) return "medium";
  return "low";
}
