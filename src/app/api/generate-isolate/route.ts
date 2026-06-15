import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireBillableImageGenerationUser } from "@/app/(dashboard)/inhalte-erstellen/lib/api-guards";
import { removeBackground } from "@/app/(dashboard)/inhalte-erstellen/lib/image-clients/background-removal";
import { buildProductIsolatePrompt } from "@/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/product-isolate";
import { productIsolateSchema } from "@/app/(dashboard)/inhalte-erstellen/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

const BG_COLOR = {
  transparent: "transparent",
  weiss: "#FFFFFF",
  schwarz: "#000000",
} as const;

export async function POST(req: Request) {
  try {
    const guard = await requireBillableImageGenerationUser(req, "generate-isolate");
    if (!guard.ok) return guard.response;

    const parsed = productIsolateSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const detail = issue ? `${issue.path.join(".")}: ${issue.message}` : "Payload validation failed.";
      return NextResponse.json({ error: `Ungültige Anfrage. ${detail}` }, { status: 400 });
    }

    const input = parsed.data;
    const prompt = buildProductIsolatePrompt(input);
    const cutout = await removeBackground({
      imageUrl: input.inputBild,
      bgColor: BG_COLOR[input.hintergrund],
      keepShadow: input.schattenErhalten,
    });
    const output =
      input.outputFormat === "webp" ? await sharp(cutout).webp({ quality: 95 }).toBuffer() : await sharp(cutout).png().toBuffer();
    const mime = input.outputFormat === "webp" ? "image/webp" : "image/png";

    return NextResponse.json({
      mode: "product_isolate",
      prompt,
      image: `data:${mime};base64,${output.toString("base64")}`,
      model: process.env.PHOTOROOM_API_KEY ? "photoroom-segment" : "remove.bg",
      userId: guard.userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Freisteller-Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
