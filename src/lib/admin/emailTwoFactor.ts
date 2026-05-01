import crypto from "crypto";

const ADMIN_2FA_VERIFIED_COOKIE = "evglab_admin_2fa_verified";
const ADMIN_2FA_PENDING_COOKIE = "evglab_admin_2fa_pending";

type PendingPayload = {
  userId: string;
  email: string;
  expiresAt: number;
  nonce: string;
  codeHash: string;
};

type VerifiedPayload = {
  userId: string;
  expiresAt: number;
};

function getSecret() {
  const configured = process.env.ADMIN_2FA_SECRET || process.env.NEXTAUTH_SECRET;
  if (!configured || configured.trim().length < 32) {
    throw new Error("ADMIN_2FA_SECRET (oder NEXTAUTH_SECRET) fehlt oder ist zu kurz (min. 32 Zeichen).");
  }
  return configured;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encodeSigned<T extends object>(payload: T) {
  const raw = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(raw);
  return `${raw}.${signature}`;
}

function decodeSigned<T extends object>(token?: string | null): T | null {
  if (!token) return null;
  const [raw, signature] = token.split(".");
  if (!raw || !signature) return null;
  if (sign(raw) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function createOneTimeCode() {
  return String(crypto.randomInt(100_000, 999_999));
}

function createCodeHash(input: { userId: string; code: string; nonce: string; expiresAt: number }) {
  return crypto
    .createHash("sha256")
    .update(`${input.userId}:${input.code}:${input.nonce}:${input.expiresAt}:${getSecret()}`)
    .digest("hex");
}

export function buildPending2FAToken(input: { userId: string; email: string; code: string; ttlSeconds?: number }) {
  const ttl = Math.max(input.ttlSeconds ?? 600, 60);
  const expiresAt = Date.now() + ttl * 1000;
  const nonce = crypto.randomBytes(12).toString("hex");
  const codeHash = createCodeHash({
    userId: input.userId,
    code: input.code,
    nonce,
    expiresAt,
  });
  const payload: PendingPayload = {
    userId: input.userId,
    email: input.email,
    expiresAt,
    nonce,
    codeHash,
  };
  return encodeSigned(payload);
}

export function verifyPending2FACode(token: string | null | undefined, input: { userId: string; code: string }) {
  const payload = decodeSigned<PendingPayload>(token);
  if (!payload) return { ok: false as const, reason: "invalid_token" };
  if (payload.userId !== input.userId) return { ok: false as const, reason: "user_mismatch" };
  if (Date.now() > payload.expiresAt) return { ok: false as const, reason: "expired" };
  const expected = createCodeHash({
    userId: payload.userId,
    code: input.code.trim(),
    nonce: payload.nonce,
    expiresAt: payload.expiresAt,
  });
  if (expected !== payload.codeHash) return { ok: false as const, reason: "invalid_code" };
  return { ok: true as const, payload };
}

export function hasValidPending2FAForUser(token: string | null | undefined, userId: string) {
  const payload = decodeSigned<PendingPayload>(token);
  if (!payload) return false;
  if (payload.userId !== userId) return false;
  if (Date.now() > payload.expiresAt) return false;
  return true;
}

export function buildVerified2FAToken(input: { userId: string; ttlSeconds?: number }) {
  const ttl = Math.max(input.ttlSeconds ?? 43_200, 300);
  const payload: VerifiedPayload = {
    userId: input.userId,
    expiresAt: Date.now() + ttl * 1000,
  };
  return encodeSigned(payload);
}

export function isVerified2FAForUser(token: string | null | undefined, userId: string) {
  const payload = decodeSigned<VerifiedPayload>(token);
  if (!payload) return false;
  if (payload.userId !== userId) return false;
  if (Date.now() > payload.expiresAt) return false;
  return true;
}

export function getPendingCookieName() {
  return ADMIN_2FA_PENDING_COOKIE;
}

export function getVerifiedCookieName() {
  return ADMIN_2FA_VERIFIED_COOKIE;
}

export async function sendAdmin2FACodeEmail(input: { to: string; code: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_2FA_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY oder ADMIN_2FA_FROM_EMAIL fehlt.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Dein Admin Sicherheitscode",
      text: `Dein Admin-Login-Code lautet: ${input.code}. Der Code ist 10 Minuten gültig.`,
      html: `<p>Dein Admin-Login-Code lautet:</p><p style="font-size:28px;font-weight:700;letter-spacing:2px">${input.code}</p><p>Der Code ist 10 Minuten gültig.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`E-Mail-Versand fehlgeschlagen: ${body}`);
  }
}
