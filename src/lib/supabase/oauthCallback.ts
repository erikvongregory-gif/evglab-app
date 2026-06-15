import type { EmailOtpType, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { redirectWithAdminEmail2FAIfNeeded } from "@/lib/admin/postSignInAdmin2FA";
import { getAppBaseUrlOrigin, isInviteOnlyEnabled, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  acquireOAuthCode,
  completeOAuthCode,
  releaseOAuthCode,
} from "@/lib/supabase/oauthInFlight";
import {
  applyBridgedCookies,
  bridgeOAuthSession,
  peekBridgedOAuthSession,
} from "@/lib/supabase/oauthSessionBridge";
import { createAuthRouteHandlerClient, createRouteHandlerClient } from "@/lib/supabase/server";
import {
  createNoStoreRedirect,
  createOAuthSessionPollerHtml,
  createRecoveryHashForwardHtml,
  createRedirectWithCookies,
  normalizeNextPath,
} from "@/lib/security/authResponses";
import { getOrCreateRequestId, logAuthEvent } from "@/lib/security/authObservability";

function authErrorParam(code?: string) {
  if (code === "flow_state_not_found" || code === "pkce_code_verifier_not_found") {
    return "oauth_state";
  }
  return "auth";
}

function finishUrl(appOrigin: string, safeNext: string) {
  return `${appOrigin}/auth/finish?next=${encodeURIComponent(safeNext)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBridgedSession(code: string, maxMs: number) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const bridged = peekBridgedOAuthSession(code);
    if (bridged) return bridged;
    await sleep(200);
  }
  return null;
}

function sessionPollerResponse(
  appOrigin: string,
  postAuthNext: string,
  requestId: string,
  cookieSource?: NextResponse,
) {
  return createOAuthSessionPollerHtml(
    {
      successUrl: `${appOrigin}${postAuthNext}`,
      fallbackUrl: finishUrl(appOrigin, postAuthNext),
      requestId,
    },
    cookieSource,
  );
}

async function redirectAfterOAuthSuccess(
  request: Request,
  opts: {
    requestId: string;
    appOrigin: string;
    postAuthNext: string;
    isPasswordRecovery: boolean;
    redirectResponse: NextResponse;
    startedAt: number;
    user: User | null | undefined;
    logEvent?: string;
    oauthCode?: string;
  },
) {
  const { requestId, appOrigin, postAuthNext, isPasswordRecovery, redirectResponse, startedAt, user } =
    opts;

  if (opts.oauthCode && user?.id) {
    bridgeOAuthSession(opts.oauthCode, redirectResponse, user.id);
  }

  if (!isPasswordRecovery && user) {
    const admin2fa = await redirectWithAdminEmail2FAIfNeeded(request, {
      user,
      requestId,
      origin: appOrigin,
      cookieSource: redirectResponse,
      startedAt,
      logEvent: opts.logEvent ?? "oauth_admin_2fa_required",
    });
    if (admin2fa) return admin2fa;
  }

  logAuthEvent({
    event: opts.logEvent ?? "oauth_exchange_success",
    requestId,
    userId: user?.id,
    email: user?.email ?? undefined,
    status: 303,
    durationMs: Date.now() - startedAt,
  });

  return createRedirectWithCookies(`${appOrigin}${postAuthNext}`, requestId, redirectResponse);
}

async function finishFromBridge(
  request: Request,
  opts: {
    code: string;
    requestId: string;
    appOrigin: string;
    postAuthNext: string;
    isPasswordRecovery: boolean;
    startedAt: number;
    logEvent: string;
  },
) {
  const bridged = peekBridgedOAuthSession(opts.code);
  if (!bridged) return null;

  const redirectResponse = createNoStoreRedirect(`${opts.appOrigin}${opts.postAuthNext}`, opts.requestId);
  applyBridgedCookies(redirectResponse, bridged);
  return redirectAfterOAuthSuccess(request, {
    requestId: opts.requestId,
    appOrigin: opts.appOrigin,
    postAuthNext: opts.postAuthNext,
    isPasswordRecovery: opts.isPasswordRecovery,
    redirectResponse,
    startedAt: opts.startedAt,
    user: { id: bridged.userId } as User,
    logEvent: opts.logEvent,
    oauthCode: opts.code,
  });
}

export async function handleAuthCallbackGet(request: Request) {
  const startedAt = Date.now();
  const requestId = getOrCreateRequestId(request);
  const { searchParams, origin } = new URL(request.url);
  const appOrigin = getAppBaseUrlOrigin(origin);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const safeNext = normalizeNextPath(searchParams.get("next"));
  const isPasswordRecovery =
    type === "recovery" || safeNext === "/passwort-zuruecksetzen";
  const postAuthNext = isPasswordRecovery ? "/passwort-zuruecksetzen" : safeNext;

  if (!isSupabaseConfigured()) {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=config`, requestId);
  }
  if (isInviteOnlyEnabled() && type === "signup") {
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=invite_required`, requestId);
  }

  if (tokenHash && type) {
    const redirectResponse = createNoStoreRedirect(`${appOrigin}${postAuthNext}`, requestId);
    const supabase = await createAuthRouteHandlerClient(redirectResponse);
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return redirectAfterOAuthSuccess(request, {
        requestId,
        appOrigin,
        postAuthNext,
        isPasswordRecovery,
        redirectResponse,
        startedAt,
        user,
        logEvent: "email_otp_verified",
      });
    }
  }

  if (!code) {
    if (isPasswordRecovery) {
      return createRecoveryHashForwardHtml({
        targetUrl: `${appOrigin}${postAuthNext}`,
        fallbackUrl: `${appOrigin}/passwort-vergessen?error=session`,
        requestId,
      });
    }
    return createNoStoreRedirect(`${appOrigin}/anmelden?error=auth`, requestId);
  }

  const bridgedEarly = await finishFromBridge(request, {
    code,
    requestId,
    appOrigin,
    postAuthNext,
    isPasswordRecovery,
    startedAt,
    logEvent: "oauth_bridge_early",
  });
  if (bridgedEarly) return bridgedEarly;

  if (acquireOAuthCode(code) === "wait") {
    logAuthEvent({
      event: "oauth_callback_duplicate_wait",
      requestId,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    await waitForBridgedSession(code, 40_000);
    const fromBridge = await finishFromBridge(request, {
      code,
      requestId,
      appOrigin,
      postAuthNext,
      isPasswordRecovery,
      startedAt,
      logEvent: "oauth_bridge_after_wait",
    });
    if (fromBridge) return fromBridge;

    const waitRedirect = createNoStoreRedirect(`${appOrigin}${postAuthNext}`, requestId);
    return sessionPollerResponse(appOrigin, postAuthNext, requestId, waitRedirect);
  }

  const redirectResponse = createNoStoreRedirect(`${appOrigin}${postAuthNext}`, requestId);
  const supabase = createRouteHandlerClient(request, redirectResponse);

  try {
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();
    if (existingUser) {
      completeOAuthCode(code);
      return redirectAfterOAuthSuccess(request, {
        requestId,
        appOrigin,
        postAuthNext,
        isPasswordRecovery,
        redirectResponse,
        startedAt,
        user: existingUser,
        logEvent: "oauth_session_exists",
        oauthCode: code,
      });
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      completeOAuthCode(code);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return redirectAfterOAuthSuccess(request, {
        requestId,
        appOrigin,
        postAuthNext,
        isPasswordRecovery,
        redirectResponse,
        startedAt,
        user,
        oauthCode: code,
      });
    }

    const bridgedAfterError = await finishFromBridge(request, {
      code,
      requestId,
      appOrigin,
      postAuthNext,
      isPasswordRecovery,
      startedAt,
      logEvent: "oauth_bridge_after_exchange_error",
    });
    if (bridgedAfterError) return bridgedAfterError;

    completeOAuthCode(code);

    if (authErrorParam(error.code) === "oauth_state") {
      logAuthEvent({
        event: "oauth_callback_finish_recovery",
        level: "info",
        requestId,
        status: 200,
        durationMs: Date.now() - startedAt,
        meta: { code: error.code },
      });
      return sessionPollerResponse(appOrigin, postAuthNext, requestId, redirectResponse);
    }

    logAuthEvent({
      event: "callback_exchange_error",
      level: "warn",
      requestId,
      status: 303,
      durationMs: Date.now() - startedAt,
      meta: { message: error.message, code: error.code },
    });
    const errorPath = isPasswordRecovery
      ? "/passwort-vergessen?error=session"
      : `/anmelden?error=${authErrorParam(error.code)}&detail=${encodeURIComponent(error.code ?? "exchange_failed")}`;
    return createNoStoreRedirect(`${appOrigin}${errorPath}`, requestId);
  } catch (error) {
    releaseOAuthCode(code);
    throw error;
  }
}
