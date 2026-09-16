import { createAdminClient } from "@/lib/supabase/admin";
import {
  isTruthyTermsAcceptance,
  TERMS_ACCEPTANCE_FORM_FIELD,
  termsAcceptanceMetadata,
} from "@/lib/auth/termsAcceptance";
import { getAppBaseUrlOrigin, isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  consumeInviteByToken,
  evaluateInvite,
  getInviteByToken,
  releaseInviteById,
} from "@/lib/invite/server";
import { createNoStoreRedirect, normalizeNextPath } from "@/lib/security/authResponses";
import { buildCompositeIdentifier, enforceRateLimitPersistent, enforceSameOrigin } from "@/lib/security/requestGuards";
import { getOrCreateRequestId } from "@/lib/security/authObservability";

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const origin = getAppBaseUrlOrigin(new URL(request.url).origin);
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${origin}/anmelden?mode=register&error=config`, requestId);
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const breweryName = String(formData.get("brewery") ?? "").trim();
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  const next = normalizeNextPath(String(formData.get("next") ?? "/dashboard"));
  const acceptedTerms = isTruthyTermsAcceptance(formData.get(TERMS_ACCEPTANCE_FORM_FIELD));
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

  if (!acceptedTerms) {
    if (inviteToken) {
      return createNoStoreRedirect(`${origin}/invite/${encodeURIComponent(inviteToken)}?error=terms`, requestId);
    }
    return createNoStoreRedirect(`${origin}/anmelden?mode=register&error=terms`, requestId);
  }

  if (!email || !password) {
    return createNoStoreRedirect(`${origin}/anmelden?mode=register&error=missing`, requestId);
  }

  if (isInviteOnlyEnabled() && !inviteToken) {
    return createNoStoreRedirect(`${origin}/anmelden?mode=register&error=invite_required`, requestId);
  }

  let reservedInviteId: string | null = null;
  if (isInviteOnlyEnabled()) {
    const invite = await getInviteByToken(inviteToken);
    const status = evaluateInvite(invite, email);
    if (status !== "valid" || !invite) {
      const reason =
        status === "expired"
          ? "invite_expired"
          : status === "used"
            ? "invite_used"
            : status === "email_mismatch"
              ? "invite_email_mismatch"
              : "invite_invalid";
      return createNoStoreRedirect(`${origin}/anmelden?mode=register&error=${reason}`, requestId);
    }
    const consumed = await consumeInviteByToken(inviteToken, email);
    if (!consumed.ok || !consumed.invite) {
      const reason =
        consumed.status === "expired"
          ? "invite_expired"
          : consumed.status === "used"
            ? "invite_used"
            : consumed.status === "email_mismatch"
              ? "invite_email_mismatch"
              : "invite_invalid";
      return createNoStoreRedirect(`${origin}/anmelden?mode=register&error=${reason}`, requestId);
    }
    reservedInviteId = consumed.invite.id;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      brewery_name: breweryName || null,
      invited_account: isInviteOnlyEnabled(),
      ...termsAcceptanceMetadata(),
    },
  });

  if (error || !data.user) {
    if (reservedInviteId) {
      await releaseInviteById(reservedInviteId).catch(() => undefined);
    }
    return createNoStoreRedirect(`${origin}/anmelden?mode=register&error=auth`, requestId);
  }

  if (isInviteOnlyEnabled()) {
    return createNoStoreRedirect(`${origin}/anmelden?notice=invite_ready`, requestId);
  }

  // Registrierung erzeugt keine Session: der Login setzt danach den 2FA-Code an.
  const loginUrl = new URL(`${origin}/anmelden`);
  loginUrl.searchParams.set("notice", "account_ready");
  if (next !== "/dashboard") loginUrl.searchParams.set("next", next);
  return createNoStoreRedirect(loginUrl.toString(), requestId);
}
