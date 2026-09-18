import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { acceptWorkspaceInvite } from "@/lib/dashboard/teamInvites";
import { enforceSameOrigin, enforceRateLimitPersistent } from "@/lib/security/requestGuards";

export async function POST(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user?.email || !user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Bitte mit der eingeladenen E-Mail anmelden und diese bestätigen." },
      { status: 401 },
    );
  }
  if (!(await hasPassedTwoFactor(user))) {
    return NextResponse.json({ error: "Bitte zuerst die Zwei-Faktor-Prüfung abschließen." }, { status: 403 });
  }
  const limit = await enforceRateLimitPersistent(
    req,
    { keyPrefix: "team-accept", limit: 10, windowMs: 60000 },
    { identifierParts: [user.id] },
  );
  if (limit) return limit;
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ error: "Ungültige Einladung." }, { status: 400 });
  }
  const normalized = token.toLowerCase();
  const result = await acceptWorkspaceInvite({
    userId: user.id,
    email: user.email,
    tokenHash: createHash("sha256").update(normalized).digest("hex"),
  });
  if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: 409 });
  return NextResponse.json({ ok: true });
}
