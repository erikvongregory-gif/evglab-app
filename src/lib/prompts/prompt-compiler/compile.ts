import type Anthropic from "@anthropic-ai/sdk";
import type { HyperrealisticInput } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";
import { FLASCHEN_TYPEN } from "@/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge";
import { createAnthropicMessageWithModelFallback } from "@/lib/anthropic/modelCandidates";
import type { VisionReferenceImage } from "@/lib/brand/reference-image-bytes";
import { assembleMasterPrompt } from "./assemble-master-prompt";
import {
  compiledBriefSchema,
  masterPromptHasRequiredSections,
  type CompiledBrief,
} from "./schema";
import { validateBriefForGeneration } from "./validate";

export type CompileBriefParams = {
  anthropic?: Anthropic | null;
  input: HyperrealisticInput;
  breweryName?: string;
  brandProfileContext?: string;
  hasProductPhoto: boolean;
  hasShapeReference: boolean;
  referenceImages?: VisionReferenceImage[];
};

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Compiler lieferte kein JSON-Objekt.");
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function hasUsableBrief(input: HyperrealisticInput): boolean {
  if (input.zusatzWunsch?.trim()) return true;
  if (input.contentPreset && input.contentPreset !== "hyperreal") return true;
  // Szene allein reicht nur mit freiem Intent oder Preset-Note — Defaults ohne Brief blocken.
  return Boolean(input.zusatzWunsch?.trim());
}

function buildFallbackCompiled(params: CompileBriefParams, pre: ReturnType<typeof validateBriefForGeneration>): CompiledBrief {
  const image_prompt = assembleMasterPrompt({
    input: params.input,
    breweryName: params.breweryName,
    brandContext: params.brandProfileContext,
    hasProductPhoto: params.hasProductPhoto,
    hasShapeReference: params.hasShapeReference,
  });
  const bottle = FLASCHEN_TYPEN[params.input.flaschenTyp];
  return compiledBriefSchema.parse({
    normalized_brief: {
      scene: params.input.zusatzWunsch?.trim() || params.input.szene,
      action: "",
      people: params.input.personenModus === "A" ? "" : `modus ${params.input.personenModus}`,
      mood: params.input.stimmungTrend ?? "",
      channel: "Instagram / Website",
      format: params.input.aspectRatio ?? "4:5",
    },
    missing_information: pre.missing_information,
    blocking_issues: pre.blocking_issues,
    reference_roles: params.hasProductPhoto
      ? [
          { index: 1, role: "product", note: "Produkt + Etikett" },
          { index: 1, role: "label", note: "Label 1:1" },
        ]
      : params.hasShapeReference
        ? [{ index: 1, role: "shape", note: bottle.display_name }]
        : [],
    image_prompt,
    preserve_constraints: [...bottle.preserve],
    exclusions: [
      "keine alternative Flaschenform",
      "keine fremden Logos",
      "kein schwebendes Produkt ohne Hände",
    ],
    generation_settings: {
      aspectRatio: params.input.aspectRatio,
      quality: params.input.quality === "high" ? "high" : "medium",
    },
  });
}

const COMPILER_SYSTEM = `Du bist der BrewAI Prompt-Compiler für fotorealistische Bier-Produktmotive.
Du erfindest KEINE Flaschenmaße, Etiketten oder Logos.
Du antwortest NUR mit einem JSON-Objekt (kein Markdown außerhalb), Schema:
{
  "normalized_brief": { "scene": "", "action": "", "people": "", "mood": "", "channel": "", "format": "" },
  "missing_information": [],
  "blocking_issues": [],
  "reference_roles": [{ "index": 1, "role": "product|label|mood|shape", "note": "" }],
  "image_prompt": "vollständiger Master-Prompt",
  "preserve_constraints": [],
  "exclusions": [],
  "generation_settings": { "aspectRatio": "4:5", "quality": "medium" }
}

image_prompt MUSS diese Abschnitte in dieser Reihenfolge enthalten (Überschriften exakt):
AUFGABE UND VERWENDUNGSZWECK
HAUPTPRODUKT
REFERENZEN
SZENE UND KOMPOSITION
LICHT UND MATERIAL
MARKENWIRKUNG
TEXT UND ETIKETT
ZWINGEND BEIBEHALTEN
NICHT VERÄNDERN ODER HINZUFÜGEN
AUSGABE

Regeln:
- Kundenbrief (USER SCENE) ist verbindlich für Szene/Aktion.
- Bei Anstoßen/Prost/angestoßen: sichtbare Hände mit Gläsern — nie Flasche+Glas die allein „anstoßen“.
- Referenzbild 1 = nur Produktidentität; Hintergrund der Referenz verwerfen.
- blocking_issues nur für kritische Lücken (fehlendes Produktfoto bei Marke, fehlende Formreferenz).
- Schreibe den Master-Prompt auf Englisch in den Abschnitten, Überschriften bleiben Deutsch wie oben.`;

export async function compileBrief(params: CompileBriefParams): Promise<CompiledBrief> {
  const pre = validateBriefForGeneration({
    input: params.input,
    hasProductPhoto: params.hasProductPhoto,
    hasUsableBrief: hasUsableBrief(params.input),
  });

  // Harte Blocks: kein Claude/OpenAI nötig.
  if (pre.blocking_issues.length > 0) {
    return buildFallbackCompiled(params, pre);
  }

  const bottle = FLASCHEN_TYPEN[params.input.flaschenTyp];
  const fallback = buildFallbackCompiled(params, pre);

  if (!params.anthropic) {
    return fallback;
  }

  const userPayload = {
    kundenbrief: params.input.zusatzWunsch?.trim() || null,
    breweryName: params.breweryName || null,
    brandProfileContext: params.brandProfileContext || null,
    bottle_catalog: {
      type: params.input.flaschenTyp,
      display_name: bottle.display_name,
      geometry_profile: bottle.geometry_profile,
      closure: bottle.closure,
      glass_color: params.input.flaschenfarbe,
      preserve: bottle.preserve,
      hasShapeReference: bottle.hasShapeReference,
      forbidden: bottle.forbidden,
    },
    ui_fields: {
      szene: params.input.szene,
      tageszeit: params.input.tageszeit,
      behaelter: params.input.behaelter,
      personenModus: params.input.personenModus,
      gruppenAnzahl: params.input.gruppenAnzahl,
      gruppenDynamik: params.input.gruppenDynamik,
      shotType: params.input.shotType,
      aspectRatio: params.input.aspectRatio,
      etikettModus: params.input.etikettModus,
      stiltreue: params.input.stiltreue,
      contentPreset: params.input.contentPreset,
      beerName: params.input.beerName,
    },
    hasProductPhoto: params.hasProductPhoto,
    hasShapeReference: params.hasShapeReference,
    seed_master_prompt: fallback.image_prompt,
  };

  try {
    const imageBlocks =
      params.referenceImages?.slice(0, 2).map((img) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data: img.base64,
        },
      })) ?? [];

    const response = await createAnthropicMessageWithModelFallback(params.anthropic, {
      max_tokens: 3500,
      temperature: 0.2,
      system: COMPILER_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `Kompiliere diesen BrewAI-Auftrag zu JSON:\n${JSON.stringify(userPayload, null, 2)}`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((item) => item.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = compiledBriefSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) {
      console.warn("[prompt-compiler] invalid JSON schema:", parsed.error.issues[0]?.message);
      return fallback;
    }

    let compiled = parsed.data;
    // Pre-Validation Issues nie verlieren.
    compiled = {
      ...compiled,
      blocking_issues: Array.from(new Set([...pre.blocking_issues, ...compiled.blocking_issues])),
      missing_information: Array.from(
        new Set([...pre.missing_information, ...compiled.missing_information]),
      ),
    };

    if (!masterPromptHasRequiredSections(compiled.image_prompt)) {
      const rebuilt = assembleMasterPrompt({
        input: params.input,
        breweryName: params.breweryName,
        brandContext: params.brandProfileContext,
        hasProductPhoto: params.hasProductPhoto,
        hasShapeReference: params.hasShapeReference,
        sceneOverride: compiled.normalized_brief.scene,
        actionOverride: compiled.normalized_brief.action,
        peopleOverride: compiled.normalized_brief.people,
        moodOverride: compiled.normalized_brief.mood,
        channel: compiled.normalized_brief.channel,
      });
      compiled = { ...compiled, image_prompt: rebuilt };
    }

    return compiled;
  } catch (error) {
    console.warn("[prompt-compiler] Claude compile failed, using deterministic prompt:", error);
    return fallback;
  }
}

export { hasUsableBrief };
