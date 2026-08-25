# KI-Provider: Guthaben, Ausfallsicherheit und Verifizierungen

Betriebshandbuch für alles, was BrewAI an externen KI-Diensten braucht. Stand: August 2026.

## 1) Wichtig zuerst: Guthaben-Auffüllung ist keine Code-Aufgabe

Kein Anbieter erlaubt es, das eigene Guthaben per API aufzuladen. Auto-Recharge ist
überall eine **Einstellung im Dashboard des Anbieters** mit hinterlegter Kreditkarte.
Diese Einstellungen müssen einmal manuell gesetzt werden — sonst steht die App still,
sobald das Prepaid-Guthaben aufgebraucht ist.

| Anbieter | Wo einstellen | Was setzen |
|----------|---------------|------------|
| **OpenAI** (Bildgenerierung) | platform.openai.com → Settings → Billing → Auto recharge | Schwelle + Aufladebetrag (Minimum 5 USD) und optional ein monatliches Auflade-Limit |
| **Anthropic** (Prompt-Generierung, Markenanalyse) | console.anthropic.com → Settings → Billing → Auto-reload → Edit | Mindestguthaben als Auslöser + Aufladebetrag |
| **kie.ai** (Videos, Referenz-Uploads) | kie.ai Dashboard → Billing | Guthaben manuell überwachen; Auto-Top-up nur falls angeboten |
| **Photoroom / remove.bg** (Freisteller) | jeweiliges Dashboard | Abo bzw. Credit-Paket |
| **Resend** (E-Mail, 2FA-Codes) | resend.com → Settings | Plan mit ausreichendem Monatsvolumen |

### Absicherung gegen Kostenexplosion

Auto-Recharge allein ist gefährlich: ein Fehler in einer Schleife kann mehrere
Aufladungen hintereinander auslösen. Deshalb immer beides setzen:

- **OpenAI:** Settings → Limits → monatliches Hard-Spend-Limit plus Alarm bei 80 %.
  Ein erreichtes Limit liefert HTTP 429 mit `organization_spend_limit_exceeded`.
- **Anthropic:** monatliches Auflade-Limit im Auto-reload begrenzen.
- Im Auto-Recharge ein monatliches Auflade-Limit hinterlegen, nicht nur Schwelle
  und Betrag.

## 2) Verifizierungen und Freigaben ("Zertifikate")

Im Code sind **keine** TLS-Zertifikate, keine Custom-CA und kein mTLS nötig —
alle Anbieter laufen über normales HTTPS. Es gibt aber echte Freigaben,
ohne die Funktionen nicht laufen:

### OpenAI Organisationsverifizierung — Pflicht für die Bildgenerierung

`gpt-image-2` (unser Standardmodell) und alle anderen GPT-Image-Modelle sind erst
nach der **API Organization Verification** nutzbar. Ohne sie kommt ein 403 bzw. 404
mit dem Hinweis „Your organization must be verified".

- platform.openai.com → Settings → Organization → General → **Verify Organization**
- Ablauf über Persona: amtliches Ausweisdokument, unverfälscht und nicht abgelaufen, plus Live-Selfie
- Ein Ausweis kann 90 Tage lang keine zweite Organisation verifizieren
- Nach Freigabe bis zu 30 Minuten Propagierung; danach ggf. neuen API-Key erzeugen
- Kein Mindestumsatz erforderlich
- Vor dem Verifizieren prüfen, dass im Dashboard die **richtige Organisation** ausgewählt ist

### Meta App Review — Pflicht für Instagram über den Testbetrieb hinaus

Der Instagram-Markenprofil-Scan läuft im Entwicklungsmodus nur mit Konten, die als
Tester eingetragen sind. Für echte Kunden braucht die App App Review inklusive
Business-Verifizierung. Details in [`docs/instagram-oauth-setup.md`](instagram-oauth-setup.md).

### Resend Domain-Verifizierung — Pflicht für 2FA

2FA ist für alle Konten verbindlich, und die Codes kommen per E-Mail. **Wenn der
Versand nicht funktioniert, kommt niemand mehr in die App.** Vor dem Go-live:

- Domain `brewai.de` in Resend verifizieren (SPF-, DKIM- und DMARC-Einträge im DNS)
- `ADMIN_2FA_FROM_EMAIL` auf eine Adresse dieser verifizierten Domain setzen
- Testweise einen Code an eine externe Adresse senden und prüfen, dass er nicht im Spam landet

### Stripe

Webhook-Signaturen werden verifiziert (`stripe.webhooks.constructEvent`). Kein
Zertifikat nötig, nur das korrekte `STRIPE_WEBHOOK_SECRET`.

## 3) Verhalten im Code, wenn ein Anbieter ausfällt

Zentral in `src/lib/ai/providerErrors.ts` und `src/lib/ai/providerRequest.ts`.

### Klassifizierte Fehler

Jeder Provider-Fehler wird in eine Kategorie übersetzt und der Nutzer bekommt eine
deutsche Meldung statt der rohen englischen Provider-Antwort:

| Code | Auslöser | HTTP | Wiederholung |
|------|----------|------|--------------|
| `provider_quota_exhausted` | `insufficient_quota`, `credit_balance_exhausted`, `organization_spend_limit_exceeded` | 503 | nein |
| `provider_rate_limited` | 429, „rate limit", „overloaded" | 429 | ja, mit Backoff |
| `provider_auth_failed` | 401/403, ungültiger Key | 503 | nein |
| `provider_content_rejected` | Inhaltsfilter des Modells | 422 | nein |
| `provider_timeout` | Timeout, 408, 504 | 504 | ja |
| `provider_unavailable` | 5xx | 503 | ja |

Wichtig: Erschöpfte Spend-Limits meldet OpenAI als **429**. Die Quota-Erkennung läuft
deshalb bewusst vor der Rate-Limit-Erkennung — sonst würden aussichtslose Anfragen
wiederholt.

### Retry mit Backoff

`withProviderRetry` wiederholt nur vorübergehende Fehler, maximal drei Versuche,
exponentiell mit Jitter, gedeckelt auf 15 Sekunden. Quota-, Auth- und
Eingabefehler werden sofort durchgereicht. Aktiv für die OpenAI-Bildgenerierung
und alle Anthropic-Aufrufe.

### Kein Token-Verlust bei Provider-Ausfall

Alle Generierungs-Routen buchen Tokens **erst nach** einem erfolgreichen Ergebnis:

- `inhalte-erstellen/create-task`: bucht nur für tatsächlich gelieferte Varianten
- `openai/image2/generate`: bucht nach Bild plus Upload
- `kie/*/create-task`: bucht nach Task-Anlage, `task-status` erstattet bei Fehlschlag zurück
- `generate-hyperrealistic`, `generate-studio`, `generate-campaign`, `generate-isolate`:
  Vorprüfung des Guthabens, Buchung nach Erfolg

### Logging

`logProviderFailure` schreibt strukturiertes JSON mit `domain: "ai-provider"`.
Quota- und Auth-Fehler landen auf `console.error`, alles andere auf `console.warn`.
So lassen sich in Vercel Alerts auf genau die zwei Fälle legen, die das Produkt
für **alle** Nutzer blockieren.

Empfohlener Vercel-Log-Drain-Filter:

```
domain:"ai-provider" AND (code:"provider_quota_exhausted" OR code:"provider_auth_failed")
```

## 4) Wöchentliche Betriebskontrolle

1. OpenAI Credit-Balance und Auto-Recharge-Historie prüfen
2. Anthropic Credit-Balance prüfen
3. kie.ai Guthaben prüfen (kein verlässliches Auto-Top-up)
4. Logs nach `provider_quota_exhausted` durchsuchen
5. Resend-Sendevolumen gegen das Planlimit prüfen
