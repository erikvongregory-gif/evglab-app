import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildHopfenHugoSystemPrompt,
  isLikelyPolicyViolation,
  policyRefusalAnswer,
} from "@/lib/assistant/hopfenHugoPolicy";
import { createAnthropicMessageWithModelFallback } from "@/lib/anthropic/modelCandidates";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { requireAuthenticatedUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
});

const requestSchema = z
  .object({
    question: z.string().trim().min(1).max(1200).optional(),
    messages: z.array(messageSchema).max(24).optional(),
    currentTab: z.string().trim().max(80).optional(),
    assistantPersona: z.string().trim().max(80).optional(),
  })
  .refine((data) => (data.messages?.length ?? 0) > 0 || Boolean(data.question?.trim()), {
    message: "Nachricht oder Verlauf erforderlich.",
  });

function fallbackAnswer(question: string): string {
  const q = question.toLowerCase();
  if (/schweizerdeutsch|schwiizerdutsch|schwiizerdütsch/.test(q)) {
    return "Ja klar, ich cha au Schwiizerdütsch rede. Frag mich eifach öppis — zu BrewAI, Marketing oder allgemeine Themen.";
  }
  if (/brewai|evglab|dashboard|mediathek|markenprofil|bilder erstellen|inhalte erstellen|abo|tarif/i.test(q)) {
    return "Gern helfe ich dir in BrewAI weiter: Dashboard, Bilder Erstellen, Markenprofil, Mediathek oder Tarife — was möchtest du wissen?";
  }
  if (/marke|brand|stil|look|prompt|bild|motiv|kampagne|social/i.test(q)) {
    return "Super Thema. Beschreib mir Produkt, Stimmung und Format — ich formuliere dir gern einen Prompt oder eine Idee.";
  }
  if (/token|billing|budget|kosten sparen|umgeh|hack/i.test(q)) {
    return policyRefusalAnswer();
  }
  return "Prost! Ich bin Hopfen Hugo — frag mich zu BrewAI, Marketing, Brauerei oder allgemeinen Themen. Bei Bild-Prompts bin ich besonders stark.";
}

function hasUsableAnthropicKey(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^paste[_-]?anthropic[_-]?api[_-]?key$/i.test(normalized)) return false;
  return true;
}

function resolveConversationMessages(input: z.infer<typeof requestSchema>): Array<{ role: "user" | "assistant"; text: string }> {
  if (input.messages?.length) {
    return input.messages.slice(-20);
  }
  if (input.question) {
    return [{ role: "user", text: input.question }];
  }
  return [];
}

export async function POST(req: Request) {
  let questionForFallback = "";
  try {
    const authGuard = await requireAuthenticatedUser(req, "brauerei-assistant-auth");
    if (!authGuard.ok) return authGuard.response;

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

    const { currentTab, assistantPersona } = parsed.data;
    const conversation = resolveConversationMessages(parsed.data);
    const lastUser = [...conversation].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "Keine Nachricht." }, { status: 400 });
    }

    questionForFallback = lastUser.text;
    if (isLikelyPolicyViolation(lastUser.text)) {
      return NextResponse.json({ answer: policyRefusalAnswer() }, { status: 200 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!hasUsableAnthropicKey(apiKey)) {
      return NextResponse.json({ answer: fallbackAnswer(lastUser.text) }, { status: 200 });
    }

    const anthropic = new Anthropic({ apiKey });
    const anthropicMessages = conversation.map((msg, index) => {
      const isLastUser = index === conversation.length - 1 && msg.role === "user";
      if (!isLastUser) {
        return { role: msg.role, content: msg.text };
      }
      return {
        role: "user" as const,
        content: [
          `Kontext: BrewAI Studio, Tab „${currentTab ?? "unbekannt"}“, Persona „${assistantPersona ?? "hopfen-hugo"}“.`,
          "Halte dich an die Nutzungsrichtlinien im System-Prompt.",
          "",
          msg.text,
        ].join("\n"),
      };
    });

    const response = await createAnthropicMessageWithModelFallback(anthropic, {
      max_tokens: 700,
      temperature: 0.45,
      system: buildHopfenHugoSystemPrompt(),
      messages: anthropicMessages,
    });

    const textBlock = response.content.find((item) => item.type === "text");
    const answer = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return NextResponse.json({ answer: answer || fallbackAnswer(lastUser.text) }, { status: 200 });
  } catch {
    return NextResponse.json({ answer: fallbackAnswer(questionForFallback) }, { status: 200 });
  }
}
