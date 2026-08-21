# BrewAI App Go-live Runbook

## 1) Pflicht-Env in Produktion

- `NEXT_PUBLIC_LOGIN_WAITLIST_ENABLED=0` — **Pflicht für Go-live** (Login/Registrierung freigeben). Solange `1` oder unset, blockiert die Middleware neue Nutzer.
- `NEXT_PUBLIC_APP_BASE_URL=https://app.brewai.de`
- `NEXT_PUBLIC_MARKETING_SITE_URL=https://brewai.de` (Alias: `NEXT_PUBLIC_SITE_URL`)
- `NEXT_PUBLIC_SITE_NAME=BrewAI`
- `NEXT_PUBLIC_PRODUCT_NAME=BrewAI`
- `NEXT_PUBLIC_COOKIE_DOMAIN=brewai.de` — Shared Cookies Marketing ↔ App (nur Production setzen)
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `AUTH_INVITE_ONLY=false`
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PRICE_START_MONTHLY=price_...`
- `STRIPE_PRICE_GROWTH_MONTHLY=price_...`
- `STRIPE_PRICE_PRO_MONTHLY=price_...`
- `STRIPE_PRICE_START_YEARLY=price_1TeElhRojElHlMEeaOShHJry` (Live) / `price_1TeEoBRsiwg9bLFFpIv3vznP` (Test)
- `STRIPE_PRICE_GROWTH_YEARLY=price_1TeElhRojElHlMEeRMLLZnUy` (Live) / `price_1TeEoBRsiwg9bLFFGkV9sJMW` (Test)
- `STRIPE_PRICE_PRO_YEARLY=price_1TeElhRojElHlMEeOuZHA68v` (Live) / `price_1TeEoCRsiwg9bLFFVoOX8v8r` (Test)
- `STRIPE_PRICE_TOKENS_500=price_...`
- `STRIPE_PRICE_TOKENS_2000=price_...`
- `STRIPE_ENABLE_AUTOMATIC_TAX=true`
- `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED=true`
- `TOKEN_STATE_SECRET=...`
- `META_APP_ID=...` und `META_APP_SECRET=...` (Instagram Markenprofil-Scan, siehe [`docs/instagram-oauth-setup.md`](instagram-oauth-setup.md) — Meta Console + Vercel Schritt-für-Schritt)

## 2) Supabase Setup

1. SQL aus `docs/billing-schema.sql` ausführen.
2. SQL aus `docs/stripe-webhook-events-schema.sql` ausführen.
3. Prüfen, dass `billing_subscriptions` und `stripe_webhook_events` existieren.
4. **Authentication → URL Configuration** (sonst hängt Google-Login in Production):
   - **Site URL:** `https://app.brewai.de` (nicht `http://localhost:3001`)
   - **Redirect URLs** (alle eintragen):
     - `https://app.brewai.de/**`
     - `http://localhost:3001/**`
5. **Authentication → Providers → Google:** aktiviert, Client ID/Secret aus Google Cloud.
6. **Google Cloud Console** → OAuth-Client → Authorized redirect URI (exakt):
   - `https://lutmsbxcjmocftiovwfs.supabase.co/auth/v1/callback`

## 3) Stripe Dashboard Setup

Konto: **evglab** (`acct_1TJanRRojElHlMEe`) — Live-Produkte/Preise sind angelegt (Metadaten `plan` / `pack` gesetzt).

| Plan / Pack | Intervall | Preis (EUR) | Hinweis |
|-------------|-----------|-------------|---------|
| Start | Monatsabo (Listenpreis) | 100 / Monat | `STRIPE_PRICE_START_MONTHLY` |
| Wachstum | Monatsabo (Listenpreis) | 200 / Monat | `STRIPE_PRICE_GROWTH_MONTHLY` |
| Pro | Monatsabo (Listenpreis) | 400 / Monat | `STRIPE_PRICE_PRO_MONTHLY` |
| Start | Jährlich (Aktionspreis) | 79 / Monat (948 / Jahr) | `STRIPE_PRICE_START_YEARLY` |
| Wachstum | Jährlich (Aktionspreis) | 149 / Monat (1.788 / Jahr) | `STRIPE_PRICE_GROWTH_YEARLY` |
| Pro | Jährlich (Aktionspreis) | 299 / Monat (3.588 / Jahr) | `STRIPE_PRICE_PRO_YEARLY` |
| +500 Tokens (einmalig) | — | 39 | `STRIPE_PRICE_TOKENS_500` → `price_1TUMhARojElHlMEeVvdClkWU` |
| +2000 Tokens (einmalig) | — | 119 | `STRIPE_PRICE_TOKENS_2000` → `price_1TUMhBRojElHlMEeblArEqAp` |

Neue Abo-Preise anlegen (gleiche Beträge in Test & Live):

```bash
node scripts/sync-stripe-plan-prices.mjs
# Live:
STRIPE_SECRET_KEY=sk_live_... node scripts/sync-stripe-plan-prices.mjs
```

1. **Live-API-Keys** unter [API keys](https://dashboard.stripe.com/acct_1TJanRRojElHlMEe/apikeys) → `STRIPE_SECRET_KEY=sk_live_…`
2. **Env in Produktion** (Vercel o. ä.) mit den neuen Live-`price_…`-IDs aus dem Sync-Skript befüllen (nicht die alten 79/149/299-Monatspreise).
3. **Stripe Tax** aktivieren und Regionen konfigurieren (oder `STRIPE_ENABLE_AUTOMATIC_TAX=false` bei Kleinunternehmer).
4. **Customer Portal** aktivieren (Settings → Billing → Customer portal), damit „Abo verwalten“ funktioniert.
5. **Webhook** auf `https://app.brewai.de/api/stripe/webhook` anlegen.
6. Events abonnieren:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid` (Token-Reset bei Abo-Verlängerung)
7. Live-Webhook-Secret in `STRIPE_WEBHOOK_SECRET` setzen.

## 4) Smoke-Test (Live-Readiness)

1. `https://brewai.de` öffnen, Dashboard-Abo wählen, auf App-Login weiterleiten.
2. Mit Google anmelden.
3. Checkout starten, Zahlung abschließen.
4. Nach Redirect prüfen:
   - Dashboard zeigt aktiven Plan.
   - Tokens sind gesetzt.
5. Token-Pack kaufen und prüfen, dass Tokens steigen.
6. Stripe-Portal öffnen (`Abo verwalten`) und Abo-Änderung testen.
7. Webhook-Retries simulieren (Stripe CLI) und prüfen, dass kein doppelte Gutschrift entsteht.

## 6) BrewAI Domains (manuell)

Nach Domain-Umstellung prüfen:

1. **Vercel** → Domains: `app.brewai.de` (Primary). Legacy `app.evglab.com` / `ki.evglab.com` dürfen auf dasselbe Projekt zeigen (Middleware → 308 auf `app.brewai.de`).
2. **Env Production:** `NEXT_PUBLIC_APP_BASE_URL`, `NEXT_PUBLIC_MARKETING_SITE_URL`, `NEXT_PUBLIC_COOKIE_DOMAIN=brewai.de`, `NEXT_PUBLIC_SITE_NAME` / `PRODUCT_NAME`.
3. **Supabase Auth** Site URL + Redirect URLs auf `https://app.brewai.de` (alte URLs optional behalten für Übergangszeit).
4. **Stripe** Webhook-Endpoint auf `https://app.brewai.de/api/stripe/webhook` (alten Endpoint deaktivieren, wenn Legacy-Host weg ist).
5. **Meta Instagram** Redirect URI + App-Domain auf `app.brewai.de`.
6. **Resend** Domain `brewai.de` verifizieren; From/Reply z. B. `kontakt@brewai.de`.
7. **Google OAuth** (falls Client-IDs an Domains gebunden): Authorized JS origins / redirect URIs prüfen.

## 7) Rollback-Option

- Bei Problemen Checkout sofort per `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED=false` deaktivieren.
- Danach nur Login/Bestandskundenzugriff aktiv lassen und Logs prüfen.
