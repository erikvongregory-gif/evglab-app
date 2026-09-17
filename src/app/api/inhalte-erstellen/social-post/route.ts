import { NextResponse } from "next/server";
import { handleStudioGenerationRequest } from "@/lib/inhalte-erstellen/run-studio-generation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  return handleStudioGenerationRequest(req, "social");
}
