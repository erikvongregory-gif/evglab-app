type SendResendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tag?: string;
};

function getFromAddress() {
  const from =
    process.env.PASSWORD_RESET_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.ADMIN_2FA_FROM_EMAIL;
  if (!from || isPlaceholderValue(from)) return null;
  if (from.includes("<")) return from;
  return `BrewAI <${from}>`;
}

function isPlaceholderValue(value: string) {
  return /PASTE|your_|changeme|example\.com/i.test(value);
}

export function isValidResendApiKey(apiKey: string | undefined) {
  const trimmed = apiKey?.trim();
  if (!trimmed || isPlaceholderValue(trimmed)) return false;
  return trimmed.startsWith("re_") && trimmed.length >= 24;
}

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getFromAddress();
  if (!isValidResendApiKey(apiKey) || !from) return null;
  return { apiKey: apiKey!, from };
}

export const RESEND_SANDBOX_FROM = "BrewAI <onboarding@resend.dev>";

export function parseResendErrorMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: string; statusCode?: number };
    return parsed.message ?? null;
  } catch {
    return null;
  }
}

export function isResendDomainNotVerifiedError(message: string) {
  return /domain is not verified/i.test(message);
}

export function isResendSandboxRecipientError(message: string) {
  return /only send testing emails to your own email/i.test(message);
}

export function extractResendSandboxAllowedEmail(message: string): string | null {
  const match = message.match(/\(([^)]+@[^)]+)\)/);
  return match?.[1] ?? null;
}

export function mapResendFailureToCode(message: string): string {
  if (message.includes("API key is invalid")) return "resend_invalid_key";
  if (isResendSandboxRecipientError(message)) return "resend_sandbox_recipient";
  if (isResendDomainNotVerifiedError(message)) return "resend_domain_unverified";
  return "email_failed";
}

export function resolveDevEmailForward(requestedTo: string): {
  to: string;
  forwarded: boolean;
  originalTo?: string;
} {
  const forward =
    process.env.NODE_ENV === "development" ? process.env.RESEND_DEV_FORWARD_TO?.trim() : undefined;
  if (forward && forward.toLowerCase() !== requestedTo.toLowerCase()) {
    return { to: forward, forwarded: true, originalTo: requestedTo };
  }
  return { to: requestedTo, forwarded: false };
}

async function postResendEmail(
  config: { apiKey: string; from: string },
  input: SendResendEmailInput,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo ?? "kontakt@brewai.de",
      tags: input.tag ? [{ name: input.tag, value: "transactional" }] : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`E-Mail-Versand fehlgeschlagen: ${body}`);
  }
}

export async function sendResendEmail(input: SendResendEmailInput, options?: { fromOverride?: string }) {
  const config = getResendConfig();
  if (!config) {
    throw new Error("RESEND_API_KEY oder Absender-Adresse (RESEND_FROM_EMAIL) fehlt.");
  }

  const from = options?.fromOverride ?? config.from;

  try {
    await postResendEmail({ apiKey: config.apiKey, from }, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (options?.fromOverride) throw error;

    if (isResendDomainNotVerifiedError(message)) {
      try {
        await postResendEmail({ apiKey: config.apiKey, from: RESEND_SANDBOX_FROM }, input);
        return;
      } catch (sandboxError) {
        const sandboxMessage = sandboxError instanceof Error ? sandboxError.message : "";
        const forward = process.env.RESEND_DEV_FORWARD_TO?.trim();
        if (
          forward &&
          isResendSandboxRecipientError(sandboxMessage) &&
          input.to.toLowerCase() !== forward.toLowerCase()
        ) {
          await postResendEmail(
            { apiKey: config.apiKey, from: RESEND_SANDBOX_FROM },
            { ...input, to: forward },
          );
          return;
        }
        throw sandboxError;
      }
    }

    if (isResendSandboxRecipientError(message)) {
      const forward = process.env.RESEND_DEV_FORWARD_TO?.trim();
      if (forward && input.to.toLowerCase() !== forward.toLowerCase()) {
        await postResendEmail({ apiKey: config.apiKey, from: RESEND_SANDBOX_FROM }, { ...input, to: forward });
        return;
      }
    }

    throw error;
  }
}
