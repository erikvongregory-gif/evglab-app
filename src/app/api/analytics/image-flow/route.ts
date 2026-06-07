import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/security/requestGuards";

const schema = z.object({
  eventName: z.enum(["flow_started", "flow_completed", "flow_failed"]),
  preset: z.enum(["hyperreal", "product_cutout", "product_studio", "campaign_social"]),
  mode: z.enum(["standard", "campaign"]),
  ts: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Telemetrie-Anfrage." }, { status: 400 });
  }
  console.info("[image-flow-metric]", parsed.data);
  return NextResponse.json({ ok: true });
}
