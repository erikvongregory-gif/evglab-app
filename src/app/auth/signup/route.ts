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
import { isTeamInviteNextPath, withNextParam } from "@/lib/auth/teamInviteAuth";
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
  const teamInviteFlow = isTeamInviteNextPath(next);
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

  const fail = (pathQuery: string) => {
    const base = `${origin}/anmelden?${pathQuery}`;
    const withNext = withNextParam(base, next);
    if (email && teamInviteFlow) {
      const u = new URL(withNext);
      u.searchParams.set("email", email);
      return createNoStoreRedirect(u.toString(), requestId);
    }
    return createNoStoreRedirect(withNext, requestId);
  };

  if (!acceptedTerms) {
    if (inviteToken) {
      return createNoStoreRedirect(`${origin}/invite/${encodeURIComponent(inviteToken)}?error=terms`, requestId);
    }
    return fail("mode=register&error=terms");
  }

  if (!email || !password) {
    return fail("mode=register&error=missing");
  }

  // Platform invite-only: allow team workspace invites via next=/invite/team/...
  if (isInviteOnlyEnabled() && !inviteToken && !teamInviteFlow) {
    return fail("mode=register&error=invite_required");
  }

  let reservedInviteId: string | null = null;
  if (isInviteOnlyEnabled() && inviteToken) {
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
      return fail(`mode=register&error=${reason}`);
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
      return fail(`mode=register&error=${reason}`);
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
      invited_account: isInviteOnlyEnabled() || teamInviteFlow,
      team_invite_pending: teamInviteFlow,
      ...termsAcceptanceMetadata(),
    },
  });

  if (error || !data.user) {
    if (reservedInviteId) {
      await releaseInviteById(reservedInviteId).catch(() => undefined);
    }
    return fail("mode=register&error=auth");
  }

  if (isInviteOnlyEnabled() && inviteToken && !teamInviteFlow) {
    return fail("notice=invite_ready");
  }

  // Registrierung erzeugt keine Session: danach Login (+ 2FA), next führt zurück zur Team-Einladung.
  const loginUrl = new URL(`${origin}/anmelden`);
  loginUrl.searchParams.set("notice", "account_ready");
  if (next !== "/dashboard") loginUrl.searchParams.set("next", next);
  if (email) loginUrl.searchParams.set("email", email);
  return createNoStoreRedirect(loginUrl.toString(), requestId);
}
