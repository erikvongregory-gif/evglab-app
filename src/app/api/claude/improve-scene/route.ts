import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyThrownProviderError } from "@/lib/ai/providerErrors";
import { logProviderFailure, providerErrorResponse } from "@/lib/ai/providerRequest";
import { requireBillableImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(800),
  breweryName: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const guard = await requireBillableImageGenerationUser(req, "claude-improve-scene");
    if (!guard.ok) return guard.response;

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt." }, { status: 500 });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }

    const brand = parsed.data.breweryName?.trim() || "die Brauerei";
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        {
          role: "user",
          content:
            `Verbessere diesen kurzen Motiv-Brief fuer eine Bier-Produktfotografie von „${brand}“. ` +
            "Schreibe 2–4 saubere deutsche Saetze: Motiv, Licht, Stimmung, Umgebung. " +
            "Kein Marketing-BlaBla, keine Hashtags, keine Parameter (--ar etc.). " +
            "Nur den verbesserten Text zurueckgeben.\n\n---\n" +
            parsed.data.text +
            "\n---",
        },
      ],
    });

    const block = message.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Keine Antwort." }, { status: 502 });
    return NextResponse.json({ text: text.slice(0, 800) });
  } catch (error) {
    const classified = classifyThrownProviderError("anthropic", error);
    logProviderFailure(classified, { label: "claude-improve-scene" });
    return providerErrorResponse(classified);
  }
}
