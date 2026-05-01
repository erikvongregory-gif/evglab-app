import { createAdminClient } from "@/lib/supabase/admin";
import { isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import { consumeInviteByToken } from "@/lib/invite/server";
import { createNoStoreRedirect, normalizeNextPath } from "@/lib/security/authResponses";
import { buildCompositeIdentifier, enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { getOrCreateRequestId } from "@/lib/security/authObservability";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const { origin } = new URL(request.url);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}/?auth=signup&error=config`, requestId);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const breweryName = String(formData.get("brewery") ?? "").trim();
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  const next = normalizeNextPath(String(formData.get("next") ?? "/dashboard"));
  const identifier = buildCompositeIdentifier(request, [email, inviteToken || null]);
  const rateLimitError = await enforceRateLimitPersistent(
    request,
    {
      keyPrefix: "auth-signup",
      limit: 6,
      windowMs: 60_000,
    },
    { identifier },
  );
  if (rateLimitError) return rateLimitError;

  if (!email || !password) {
    return createNoStoreRedirect(`${origin}/?auth=signup&error=missing`, requestId);
  }

  if (isInviteOnlyEnabled() && !inviteToken) {
    return createNoStoreRedirect(`${origin}/?auth=signup&error=invite_required`, requestId);
  }

  if (isInviteOnlyEnabled()) {
    const consumed = await consumeInviteByToken(inviteToken, email);
    if (!consumed.ok) {
      const reason =
        consumed.status === "expired"
          ? "invite_expired"
          : consumed.status === "used"
            ? "invite_used"
            : consumed.status === "email_mismatch"
              ? "invite_email_mismatch"
              : "invite_invalid";
      return createNoStoreRedirect(`${origin}/?auth=signup&error=${reason}`, requestId);
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      brewery_name: breweryName || null,
      invited_account: isInviteOnlyEnabled(),
    },
  });

  if (error || !data.user) {
    return createNoStoreRedirect(`${origin}/?auth=signup&error=auth`, requestId);
  }

  if (isInviteOnlyEnabled()) {
    return createNoStoreRedirect(`${origin}/?auth=signin&notice=invite_ready`, requestId);
  }

  return createNoStoreRedirect(`${origin}${next}`, requestId);
}
