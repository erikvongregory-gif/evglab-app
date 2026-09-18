import { createAdminClient } from "@/lib/supabase/admin";
import {
  isTruthyTermsAcceptance,
  TERMS_ACCEPTANCE_FORM_FIELD,
  termsAcceptanceMetadata,
} from "@/lib/auth/termsAcceptance";
import { mapSignupErrorCode, signupErrorDetail } from "@/lib/auth/signUpErrors";
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
import { getOrCreateRequestId, logAuthEvent } from "@/lib/security/authObservability";
import { redirectWithEmail2FAIfNeeded } from "@/lib/admin/postSignInAdmin2FA";
import { createAuthRouteHandlerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const startedAt = Date.now();
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

  if (password.length < 8) {
    return fail("mode=register&error=weak_password");
  }

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
      ...(teamInviteFlow ? { team_invite_pending: true } : {}),
      ...termsAcceptanceMetadata(),
    },
  });

  if (error || !data.user) {
    if (reservedInviteId) {
      await releaseInviteById(reservedInviteId).catch(() => undefined);
    }
    const code = error ? mapSignupErrorCode(error) : "auth";
    const detail = error ? signupErrorDetail(error) : undefined;
    logAuthEvent({
      event: "signup_failed",
      level: "error",
      requestId,
      email,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: { reason: code, supabaseMessage: detail, supabaseCode: error?.code },
    });
    if (code === "email_taken" && teamInviteFlow) {
      return fail("mode=signin&error=email_taken");
    }
    const params = new URLSearchParams({ mode: "register", error: code });
    if (detail) params.set("detail", detail);
    return fail(params.toString());
  }

  if (isInviteOnlyEnabled() && inviteToken && !teamInviteFlow) {
    return fail("notice=invite_ready");
  }

  if (teamInviteFlow) {
    const finishTarget = `${origin}/auth/finish?next=${encodeURIComponent(next)}`;
    const redirectResponse = createNoStoreRedirect(finishTarget, requestId);
    try {
      const supabase = await createAuthRouteHandlerClient(redirectResponse);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!signInError) {
        const twoFactor = await redirectWithEmail2FAIfNeeded(request, {
          user: signInData.user,
          requestId,
          origin,
          cookieSource: redirectResponse,
          startedAt,
          next,
        });
        if (twoFactor) return twoFactor;
        logAuthEvent({
          event: "signup_success",
          requestId,
          userId: data.user.id,
          email,
          status: 303,
          durationMs: Date.now() - startedAt,
          meta: { teamInvite: true, autoSignedIn: true },
        });
        return redirectResponse;
      }
      logAuthEvent({
        event: "signup_signin_failed",
        level: "warn",
        requestId,
        email,
        status: 303,
        durationMs: Date.now() - startedAt,
        meta: { supabaseMessage: signInError.message },
      });
    } catch (signInFailure) {
      logAuthEvent({
        event: "signup_signin_failed",
        level: "warn",
        requestId,
        email,
        status: 303,
        durationMs: Date.now() - startedAt,
        meta: {
          supabaseMessage:
            signInFailure instanceof Error ? signInFailure.message.slice(0, 160) : "signin_exception",
        },
      });
    }
  }

  const loginUrl = new URL(`${origin}/anmelden`);
  loginUrl.searchParams.set("notice", "account_ready");
  if (next !== "/dashboard") loginUrl.searchParams.set("next", next);
  if (email) loginUrl.searchParams.set("email", email);
  logAuthEvent({
    event: "signup_success",
    requestId,
    userId: data.user.id,
    email,
    status: 303,
    durationMs: Date.now() - startedAt,
    meta: { teamInvite: teamInviteFlow, autoSignedIn: false },
  });
  return createNoStoreRedirect(loginUrl.toString(), requestId);
}
