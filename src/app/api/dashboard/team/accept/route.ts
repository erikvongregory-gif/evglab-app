import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { enforceSameOrigin, enforceRateLimitPersistent } from "@/lib/security/requestGuards";
export async function POST(req: Request) {
  const origin = enforceSameOrigin(req); if (origin) return origin;
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user?.email || !user.email_confirmed_at) return NextResponse.json({ error: "Bitte mit der eingeladenen E-Mail anmelden und diese bestätigen." }, { status: 401 });
  if (!(await hasPassedTwoFactor(user))) return NextResponse.json({ error: "Bitte zuerst die Zwei-Faktor-Prüfung abschließen." }, { status: 403 });
  const limit=await enforceRateLimitPersistent(req,{keyPrefix:"team-accept",limit:10,windowMs:60000},{identifierParts:[user.id]});
  if(limit)return limit;
  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: "Ungültige Einladung." }, { status: 400 });
  const { error } = await createAdminClient().rpc("workspace_accept", { p_user:user.id,p_email:user.email,p_hash:createHash("sha256").update(token).digest("hex") });
  if(error)return NextResponse.json({error:error.message},{status:409});
  return NextResponse.json({ok:true});
}
