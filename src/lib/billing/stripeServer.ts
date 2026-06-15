import Stripe from "stripe";

const PLACEHOLDER_PATTERNS = [
  /^sk_(test|live)_\.{3}$/i,
  /^your[_-]?stripe/i,
  /^insert[_-]?here/i,
  /^replace[_-]?me/i,
];

export function getStripeSecretKey(): string | undefined {
  const raw = process.env.STRIPE_SECRET_KEY?.trim();
  if (!raw) return undefined;
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(raw))) return undefined;
  if (!raw.startsWith("sk_test_") && !raw.startsWith("sk_live_")) return undefined;
  return raw;
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey());
}

export function stripeConfigurationError(): string {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    return "Stripe ist nicht konfiguriert. In Vercel unter Project → Settings → Environment Variables STRIPE_SECRET_KEY (sk_live_…) für Production setzen und neu deployen.";
  }
  return "Stripe ist nicht konfiguriert. STRIPE_SECRET_KEY in .env.local eintragen (Vorlage: .env.example) und den Dev-Server neu starten.";
}

export function getStripeClient(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error(stripeConfigurationError());
  }
  return new Stripe(key);
}
