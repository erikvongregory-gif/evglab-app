import crypto from "crypto";
import { resolveDevEmailForward, sendResendEmail } from "@/lib/email/resend";

/**
 * E-Mail-2FA für alle Nutzer. Cookie-Namen bleiben aus Kompatibilitätsgründen
 * beim `admin`-Präfix, gelten aber für jedes Konto.
 */
const ADMIN_2FA_VERIFIED_COOKIE = "evglab_admin_2fa_verified";
const ADMIN_2FA_PENDING_COOKIE = "evglab_admin_2fa_pending";
const TRUSTED_DEVICE_COOKIE = "evglab_2fa_device";

export const PENDING_TTL_SECONDS = 600;
export const VERIFIED_TTL_SECONDS = 60 * 60 * 12;
export const TRUSTED_DEVICE_TTL_SECONDS = 60 * 60 * 24 * 30;

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

type TrustedDevicePayload = {
  userId: string;
  expiresAt: number;
  issuedAt: number;
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
  const ttl = Math.max(input.ttlSeconds ?? VERIFIED_TTL_SECONDS, 300);
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

/**
 * Trusted Device: nach einmal bestandener 2FA darf dasselbe Gerät 30 Tage ohne
 * neuen Code rein. Das Cookie ersetzt keinen Login, nur den zweiten Faktor.
 */
export function buildTrustedDeviceToken(input: { userId: string; ttlSeconds?: number }) {
  const ttl = Math.max(input.ttlSeconds ?? TRUSTED_DEVICE_TTL_SECONDS, 300);
  const payload: TrustedDevicePayload = {
    userId: input.userId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + ttl * 1000,
  };
  return encodeSigned(payload);
}

export function isTrustedDeviceForUser(token: string | null | undefined, userId: string) {
  const payload = decodeSigned<TrustedDevicePayload>(token);
  if (!payload) return false;
  if (payload.userId !== userId) return false;
  if (Date.now() > payload.expiresAt) return false;
  return true;
}

/**
 * Recovery-Code für das Betreiber-Konto. Nötig, weil die Owner-Adresse keinen
 * echten Mailempfang haben muss — ohne diesen Ausweg wäre der Betreiber
 * bei Mailproblemen dauerhaft ausgesperrt.
 */
export function verifyOwnerBackupCode(code: string): boolean {
  const configured = process.env.OWNER_2FA_BACKUP_CODE?.trim();
  if (!configured || configured.length < 8) return false;
  const provided = Buffer.from(code.trim(), "utf8");
  const expected = Buffer.from(configured, "utf8");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

export function getPendingCookieName() {
  return ADMIN_2FA_PENDING_COOKIE;
}

export function getVerifiedCookieName() {
  return ADMIN_2FA_VERIFIED_COOKIE;
}

export function getTrustedDeviceCookieName() {
  return TRUSTED_DEVICE_COOKIE;
}

export async function send2FACodeEmail(input: { to: string; code: string }) {
  const { to, forwarded, originalTo } = resolveDevEmailForward(input.to);
  const hint = forwarded
    ? `<p style="color:#6b7280;font-size:12px">Lokale Weiterleitung, eigentlich an ${originalTo}.</p>`
    : "";

  await sendResendEmail({
    to,
    subject: "Dein BrewAI Sicherheitscode",
    text: `Dein BrewAI-Login-Code lautet: ${input.code}. Der Code ist 10 Minuten gültig.`,
    html: `<p>Dein BrewAI-Login-Code lautet:</p><p style="font-size:28px;font-weight:700;letter-spacing:2px">${input.code}</p><p>Der Code ist 10 Minuten gültig.</p>${hint}`,
    tag: "login_2fa",
  });
}
