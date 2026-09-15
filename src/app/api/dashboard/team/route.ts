import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPassedTwoFactor } from "@/lib/auth/twoFactorSession";
import { getWorkspace } from "@/lib/dashboard/workspace";
import { ensureBillingRow } from "@/lib/billing/store";
import { enforceSameOrigin, enforceRateLimitPersistent } from "@/lib/security/requestGuards";
import { sendResendEmail } from "@/lib/email/resend";
import { getAppBaseUrlOrigin } from "@/lib/supabase/env";
const role = z.enum(["admin", "editor", "viewer"]);
async function context(req: Request, manage = false) {
  const origin = enforceSameOrigin(req); if (origin) return origin;
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!(await hasPassedTwoFactor(user.id))) return NextResponse.json({ error: "Zwei-Faktor-Prüfung erforderlich." }, { status: 403 });
  const limit = await enforceRateLimitPersistent(req,{ keyPrefix:"team",limit:30,windowMs:60000 },{identifierParts:[user.id]});
  if (limit) return limit;
  const workspace = await getWorkspace(user.id);
  if (manage && !["owner", "admin"].includes(workspace.role)) return NextResponse.json({ error: "Teamverwaltung nicht erlaubt." }, { status: 403 });
  return { ...workspace, user };
}
async function members(ownerId: string) {
  const admin = createAdminClient();
  const [owner, active, invites] = await Promise.all([
    admin.auth.admin.getUserById(ownerId),
    admin.from("workspace_members").select("*").eq("owner_id", ownerId),
    admin.from("workspace_invites").select("id,email,name,role,created_at").eq("owner_id", ownerId).gt("expires_at",new Date().toISOString()),
  ]);
  if (owner.error || active.error || invites.error) throw new Error("Team konnte nicht geladen werden.");
  const rows = await Promise.all((active.data ?? []).map(async row => {
    const member = await admin.auth.admin.getUserById(row.user_id);
    if (member.error) throw new Error("Teammitglied konnte nicht geladen werden.");
    return { id:row.user_id,email:member.data.user.email,name:member.data.user.user_metadata?.full_name ?? member.data.user.email,role:row.role,status:"active",invitedAt:row.created_at };
  }));
  return [{ id:ownerId,email:owner.data.user?.email,name:"Inhaber",role:"owner",status:"active",invitedAt:owner.data.user?.created_at },...rows,
    ...(invites.data ?? []).map(row=>({ ...row,status:"invited",invitedAt:row.created_at }))];
}
export async function GET(req: Request) {
  try { const c=await context(req); if(c instanceof NextResponse)return c; return NextResponse.json({members:await members(c.ownerId),role:c.role}); }
  catch { return NextResponse.json({error:"Team konnte nicht geladen werden."},{status:500}); }
}
export async function POST(req: Request) {
  try {
    const c=await context(req,true); if(c instanceof NextResponse)return c;
    const input=z.object({email:z.string().email().max(200),name:z.string().max(120).optional(),role:role.default("editor")}).parse(await req.json());
    if(c.role!=="owner" && input.role==="admin")return NextResponse.json({error:"Nur der Inhaber darf Administratoren einladen."},{status:403});
    if(input.email.toLowerCase()===c.user.email?.toLowerCase()) return NextResponse.json({error:"Du bist bereits im Team."},{status:409});
    await ensureBillingRow(c.ownerId);
    const token=randomBytes(32).toString("hex");
    const admin=createAdminClient();
    const invite=await admin.rpc("workspace_invite",{p_owner:c.ownerId,p_email:input.email,p_name:input.name??input.email,p_role:input.role,p_hash:createHash("sha256").update(token).digest("hex")});
    if(invite.error)return NextResponse.json({error:invite.error.message},{status:409});
    const url=`${getAppBaseUrlOrigin(new URL(req.url).origin)}/invite/team/${token}`;
    try { await sendResendEmail({to:input.email,subject:"Deine Einladung zu BrewAI",text:`Du wurdest zu einem BrewAI-Team eingeladen. Melde dich mit ${input.email} an und bestätige die Einladung: ${url}`,html:`<p>Du wurdest zu einem BrewAI-Team eingeladen.</p><p><a href="${url}">Einladung annehmen</a></p>`}); }
    catch { await admin.from("workspace_invites").delete().eq("id",invite.data); throw new Error("Einladung konnte nicht versendet werden."); }
    return NextResponse.json({ok:true,members:await members(c.ownerId)});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Einladung fehlgeschlagen."},{status:400}); }
}
export async function PATCH(req: Request) {
  try {
    const c=await context(req,true); if(c instanceof NextResponse)return c;
    const input=z.object({memberId:z.string().uuid(),role}).parse(await req.json());
    if(input.memberId===c.ownerId || (c.role!=="owner" && input.role==="admin")) return NextResponse.json({error:"Nur der Inhaber darf Administratoren bestimmen."},{status:403});
    const admin=createAdminClient();
    const existing=await admin.from("workspace_members").select("role").eq("owner_id",c.ownerId).eq("user_id",input.memberId).maybeSingle();
    if(existing.error)throw new Error(existing.error.message);
    const invitation=await admin.from("workspace_invites").select("role").eq("owner_id",c.ownerId).eq("id",input.memberId).maybeSingle();
    if(invitation.error)throw new Error(invitation.error.message);
    if(c.role!=="owner" && (existing.data?.role==="admin" || invitation.data?.role==="admin")) return NextResponse.json({error:"Nur der Inhaber darf Administratoren ändern."},{status:403});
    const result=existing.data ? await admin.from("workspace_members").update({role:input.role}).eq("owner_id",c.ownerId).eq("user_id",input.memberId)
      : await admin.from("workspace_invites").update({role:input.role}).eq("owner_id",c.ownerId).eq("id",input.memberId);
    if(result.error)throw new Error(result.error.message);
    return NextResponse.json({ok:true,members:await members(c.ownerId)});
  } catch { return NextResponse.json({error:"Rolle konnte nicht geändert werden."},{status:400}); }
}
export async function DELETE(req: Request) {
  try {
    const c=await context(req,true); if(c instanceof NextResponse)return c;
    const id=z.string().uuid().parse(new URL(req.url).searchParams.get("memberId"));
    if(id===c.ownerId)return NextResponse.json({error:"Inhaber kann nicht entfernt werden."},{status:403});
    const admin=createAdminClient();
    const existing=await admin.from("workspace_members").select("role").eq("owner_id",c.ownerId).eq("user_id",id).maybeSingle();
    const invitation=await admin.from("workspace_invites").select("role").eq("owner_id",c.ownerId).eq("id",id).maybeSingle();
    if(existing.error||invitation.error)throw new Error("Teamprüfung fehlgeschlagen.");
    if(c.role!=="owner" && (existing.data?.role==="admin" || invitation.data?.role==="admin"))return NextResponse.json({error:"Nur der Inhaber darf Administratoren entfernen."},{status:403});
    for(const [table,key] of [["workspace_members","user_id"],["workspace_invites","id"]]) {
      const result=await admin.from(table).delete().eq("owner_id",c.ownerId).eq(key,id);if(result.error)throw new Error(result.error.message);
    }
    return NextResponse.json({ok:true,members:await members(c.ownerId)});
  } catch { return NextResponse.json({error:"Teammitglied konnte nicht entfernt werden."},{status:400}); }
}
