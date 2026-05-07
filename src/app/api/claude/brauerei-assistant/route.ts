import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  currentTab: z.string().trim().max(80).optional(),
  assistantPersona: z.string().trim().max(80).optional(),
});

const HOPFEN_HUGO_SYSTEM = [
  "Du bist Hopfen Hugo, der Chat-Assistent im EvGlab-Dashboard.",
  "Du darfst ueber allgemeine, harmlose Alltagsthemen reden und auf Wunsch den Stil wechseln (z. B. Schweizerdeutsch, bayerisch, locker, freundlich).",
  "Verweigere nur unzulaessige oder gefaehrliche Inhalte (illegale Handlungen, Gewaltanleitungen, Selbstverletzung, Hass, Betrug, Datenschutzverletzungen, sexualisierte Inhalte mit Minderjaehrigen).",
  "Wenn es um EvGlab und KI-Bilder geht, gib praktische Hilfe zu Prompts, Motiven, Szenen, Licht, Stil und Markenkonsistenz.",
  "Gib keine Optimierungs- oder Spartipps zu Token, Billing, Abo oder internen Dashboard-Kosten.",
  "Antworte kurz, freundlich und natuerlich auf Deutsch; Dialekt nur wenn gewuenscht.",
].join(" ");

function fallbackAnswer(question: string): string {
  const q = question.toLowerCase();
  if (/schweizerdeutsch|schwiizerdutsch|schwiizerdütsch/.test(q)) {
    return "Ja klar, ich cha au Schwiizerdutsch rede. Wenn du wotsch, antworte ich ab jetzt im Schwiizer Stil.";
  }
  if (/bayerisch|bayrisch|dialekt|mundart|freundlich|locker|duzen|siezen|tonfall|humor|witzig/i.test(q)) {
    return "Klar, mach ich gern. Ich passe meinen Stil an und antworte dir freundlich und locker.";
  }
  if (/token|abo|billing|budget|credit|kosten sparen|spar|guenstig|günstig/i.test(q)) {
    return "Zu Token-, Abo- oder Billing-Optimierung gebe ich keine Tipps. Bei Bildideen, Prompt und Stil helfe ich dir gern.";
  }
  if (/marke|brand|stil|look|prompt|bild|motiv|foto|render|kampagne/i.test(q)) {
    return "Gern. Nenn mir Produkt, Stimmung und Format, dann formuliere ich dir direkt einen starken Prompt.";
  }
  return "Klar, ich bin da. Wenn du willst, antworte ich normal, locker, bayerisch oder Schweizerdeutsch.";
}

function getPreferredModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return "claude-3-5-sonnet-latest";
}

function hasUsableAnthropicKey(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^paste[_-]?anthropic[_-]?api[_-]?key$/i.test(normalized)) return false;
  return true;
}

export async function POST(req: Request) {
  let questionForFallback = "";
  try {
    const rateError = await enforceRateLimitPersistent(req, {
      keyPrefix: "brauerei-assistant",
      limit: 40,
      windowMs: 60_000,
    });
    if (rateError) return rateError;
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
    }

    const { question, currentTab, assistantPersona } = parsed.data;
    questionForFallback = question;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!hasUsableAnthropicKey(apiKey)) {
      return NextResponse.json({ answer: fallbackAnswer(question) }, { status: 200 });
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: getPreferredModel(),
      max_tokens: 350,
      temperature: 0.35,
      system: HOPFEN_HUGO_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `Aktiver Dashboard-Tab: ${currentTab ?? "unbekannt"}`,
            `Persona: ${assistantPersona ?? "hopfen-hugo"}`,
            "",
            "Nutzerfrage:",
            question,
            "",
            "Folge den Systemregeln: allgemein harmlose Fragen sind okay, aber keine Hilfe zu illegalen/gefaehrlichen Themen und keine Token-/Billing-Spar-Tipps.",
          ].join("\n"),
        },
      ],
    });

    const textBlock = response.content.find((item) => item.type === "text");
    const answer = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return NextResponse.json({ answer: answer || fallbackAnswer(question) }, { status: 200 });
  } catch {
    return NextResponse.json({ answer: fallbackAnswer(questionForFallback) }, { status: 200 });
  }
}
