# EvGlab App Go-live Runbook

## 1) Pflicht-Env in Produktion

- `NEXT_PUBLIC_APP_BASE_URL=https://app.evglab.com`
- `NEXT_PUBLIC_MARKETING_SITE_URL=https://evglab.com`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `AUTH_INVITE_ONLY=false`
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PRICE_START_MONTHLY=price_...`
- `STRIPE_PRICE_GROWTH_MONTHLY=price_...`
- `STRIPE_PRICE_PRO_MONTHLY=price_...`
- `STRIPE_PRICE_TOKENS_500=price_...`
- `STRIPE_PRICE_TOKENS_2000=price_...`
- `STRIPE_ENABLE_AUTOMATIC_TAX=true`
- `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED=true`
- `TOKEN_STATE_SECRET=...`

## 2) Supabase Setup

1. SQL aus `docs/billing-schema.sql` ausführen.
2. SQL aus `docs/stripe-webhook-events-schema.sql` ausführen.
3. Prüfen, dass `billing_subscriptions` und `stripe_webhook_events` existieren.

## 3) Stripe Dashboard Setup

1. Produkte/Prices für alle Abos und Token-Packs anlegen.
2. Tax in Stripe aktivieren und gewünschte Regionen konfigurieren.
3. Webhook-Endpunkt auf `/api/stripe/webhook` anlegen.
4. Events abonnieren:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Live-Webhook-Secret in `STRIPE_WEBHOOK_SECRET` setzen.

## 4) Smoke-Test (Live-Readiness)

1. `https://evglab.com` öffnen, Dashboard-Abo wählen, auf App-Login weiterleiten.
2. Mit Google anmelden.
3. Checkout starten, Zahlung abschließen.
4. Nach Redirect prüfen:
   - Dashboard zeigt aktiven Plan.
   - Tokens sind gesetzt.
5. Token-Pack kaufen und prüfen, dass Tokens steigen.
6. Stripe-Portal öffnen (`Abo verwalten`) und Abo-Änderung testen.
7. Webhook-Retries simulieren (Stripe CLI) und prüfen, dass kein doppelte Gutschrift entsteht.

## 5) Rollback-Option

- Bei Problemen Checkout sofort per `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED=false` deaktivieren.
- Danach nur Login/Bestandskundenzugriff aktiv lassen und Logs prüfen.
