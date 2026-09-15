import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyThrownProviderError } from "@/lib/ai/providerErrors";
import { logProviderFailure, providerErrorResponse } from "@/lib/ai/providerRequest";
import { enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(800),
  breweryName: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const originError = enforceSameOrigin(req);
    if (originError) return originError;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase nicht konfiguriert." }, { status: 503 });
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    const rate = await enforceRateLimitPersistent(req, {
      keyPrefix: "claude-improve-scene",
      limit: 30,
      windowMs: 60_000,
    });
    if (rate) return rate;

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
