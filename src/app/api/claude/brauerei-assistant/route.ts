import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  currentTab: z.string().trim().max(80).optional(),
  assistantPersona: z.string().trim().max(80).optional(),
});

function fallbackAnswer(question: string): string {
  if (/marke|brand|stil|look/i.test(question)) {
    return "Fokussiere dich auf 3 Dinge: Brand-Lock auf Strict setzen, Referenzbeispiele sauber halten und die Bildbeschreibung konkret mit Umgebung, Licht und Produktdetails formulieren.";
  }
  if (/token|abo|billing/i.test(question)) {
    return "Unter Abo & Tokens siehst du Verbrauch und Restbudget. Bei knappen Credits zuerst Varianten reduzieren und nur noetige Aufloesung waehlen.";
  }
  return "Ich helfe dir gern weiter. Beschreibe kurz dein Ziel (z. B. Kampagne, Stil, Plattform), dann gebe ich dir direkt den naechsten besten Schritt.";
}

function getPreferredModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return "claude-3-5-sonnet-latest";
}

export async function POST(req: Request) {
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ answer: fallbackAnswer(question) }, { status: 200 });
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: getPreferredModel(),
      max_tokens: 350,
      temperature: 0.4,
      system:
        "Du bist Hopfen-Hugo, ein hilfreicher Brauerei-Dashboard-Assistent. " +
        "Antworte auf Deutsch, kurz, praktisch und freundlich. " +
        "Gib konkrete naechste Schritte fuer Content-Erstellung, Markenkonsistenz und Dashboard-Nutzung. " +
        "Keine langen Essays, keine Markdown-Listen wenn nicht noetig.",
      messages: [
        {
          role: "user",
          content: `Aktiver Dashboard-Tab: ${currentTab ?? "unbekannt"}\nAktive Persona: ${assistantPersona ?? "hopfen-hugo"}\nFrage: ${question}`,
        },
      ],
    });

    const textBlock = response.content.find((item) => item.type === "text");
    const answer = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return NextResponse.json({ answer: answer || fallbackAnswer(question) }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Assistent konnte nicht antworten." }, { status: 500 });
  }
}
