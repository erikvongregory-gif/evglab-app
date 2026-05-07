# Go-live Checklist: Kleinunternehmer (§ 19 UStG)

Diese Checkliste stellt die technische und textliche Konsistenz fuer den Checkout sicher.

## 1) Env-Konfiguration

- `BILLING_KLEINUNTERNEHMER=true`
- `NEXT_PUBLIC_BILLING_KLEINUNTERNEHMER=true`
- `STRIPE_ENABLE_AUTOMATIC_TAX=false`

## 2) Erwartetes Checkout-Verhalten

- Stripe Checkout zeigt keine MwSt.-Position.
- Im Checkout wird der Hinweis angezeigt: "Gemaess § 19 UStG wird keine Umsatzsteuer berechnet."
- Dashboard zeigt im Bereich "Abo & Tokens" den Kleinunternehmer-Hinweis.

## 3) Rechtstexte / Kommunikation

- AGB enthalten den Hinweis auf Kleinunternehmerregelung (§ 19 UStG).
- Preisdarstellung auf der Marketing-Seite enthaelt keinen pauschalen MwSt.-Aufschlag.
- Rechnungen muessen den Hinweis tragen: "Gemaess § 19 UStG wird keine Umsatzsteuer berechnet."

## 4) Stripe Dashboard Hinweise

- Keine aktive Stripe Tax-Erhebung fuer MwSt. erforderlich, solange Kleinunternehmerstatus gilt.
- Falls spaeter Regelbesteuerung: Flags umstellen und Stripe Tax sauber aktivieren.

## 5) Smoke Test

1. Login mit Testkonto
2. Plan-Checkout starten
3. Pruefen, dass keine MwSt. aufgeschlagen wird
4. Kauf abschliessen
5. Rueckkehr ins Dashboard pruefen
