# Atomare Token-Abrechnung: Umsetzung und Rollout

## Was geändert wurde

- `store.ts`: Verbrauch, Rückerstattung und Zusatzguthaben laufen ausschließlich über PostgreSQL-RPCs. Kein nicht atomarer Fallback, auch nicht bei fehlender Migration.
- `billing-atomic-migration.sql`: Buchungen sperren die Nutzerzeile (`FOR UPDATE`); Guthabenprüfung und Abbuchung gehören zu derselben Transaktion.
- Vier verbindliche Guthabenfelder: `monthly_allowance` (Monatskontingent), `monthly_spent` (dessen Verbrauch), `purchased_balance` (unverbrauchtes Zusatzguthaben), `purchased_spent` (Verbrauch aus Zusatzguthaben in dieser Periode). Monatskontingent wird zuerst verbraucht. `monthly_tokens` und `used_tokens` bleiben als berechnete Felder für bestehende API/UI-Clients verfügbar. Direkte alte Schreibzugriffe auf diese Felder werden abgewiesen.
- Periodenwechsel setzt nur die Verbrauchszähler zurück; verbleibendes Zusatzguthaben bleibt unverändert. `last_token_period_end` verhindert erneutes Auffüllen für dieselbe oder eine ältere Periode. `subscription_update`-Rechnungen lösen keinen Monatsreset aus. Die Periode stammt aus der passenden Rechnungsposition, nicht aus dem zum Wiederholungszeitpunkt aktuellen Stripe-Abo.
- Tarifwechsel erhalten den Verbrauch und die Zusatzguthaben. Eine Herabstufung mit höherem bisherigem Monatsverbrauch ergibt null verfügbares Monatskontingent; ein anschließendes Upgrade löscht diesen Verbrauch nicht. Kündigung sperrt die Nutzung, erhält aber verbleibendes Zusatzguthaben.
- `grantTokenPackSession`: Checkout-ID und Gutschrift werden in einer DB-Transaktion verbucht. Fehler rollen beides zurück. Webhook und `confirm-session` benutzen diese Operation. Token-Käufe umgehen die separate Webhook-Event-Reservierung, damit deren verwaister `processing`-Eintrag einen Kauf nicht blockiert.
- Gutschrift erst bei `payment_status=paid`; verzögerte Zahlungen werden über `checkout.session.async_payment_succeeded` unterstützt.
- `stripeSync.ts` rekonstruiert Guthaben nicht mehr aus allen historischen Checkout-Käufen. Die aktuelle Price-ID hat Vorrang vor möglicherweise alten Plan-Metadaten.
- Onboarding-Bonus und manuelle Admin-Tarifzuweisung wurden an die neuen Guthabenfelder angepasst. Der Bonus besitzt zusätzlich eine DB-seitige Einmal-Sperre. Die bisherige explizite Admin-Rücksetzung setzt weiterhin das gesamte Guthaben zurück.

## Vorbereitung (Stand 15.09.2026)

Erledigt vor dem Go-Live-Fenster:

- `npm run billing:preflight` — prüft Tabellen, Migrationsstand, hängende Webhooks, Grant-Audit
- `npm run billing:sync-webhook` — Test-Webhook um `checkout.session.async_payment_succeeded` ergänzt (`we_1TJb2gRsiwg9bLFFbjbzPOW2` → `https://app.brewai.de/api/stripe/webhook`)
- `scripts/billing-atomic-rollout.mjs` — Preflight, Webhook-Sync, Migration (`billing:migrate` mit `SUPABASE_DB_URL`)
- Build-Blocker in `hyperrealistic.ts` behoben (`gruppenAnzahl` `"4_5"`)

Prod-DB (lutmsbxcjmocftiovwfs / auth.brewai.de): Basis-Tabellen vorhanden, **35** Billing-Zeilen, **0** hängende `processing`-Events. Atomare Spalten/RPCs **noch nicht** angewendet — Migration erst im Wartungsfenster zusammen mit App-Deploy.

Live-Stripe-Webhook: `npm run billing:sync-webhook:live` (benötigt `STRIPE_LIVE_SECRET_KEY` oder `sk_live_` in der Umgebung).

## Rollout (Wartungsfenster — noch nicht ausgeführt)

1. Datenbank-Backup erstellen. Bestehende Guthaben prüfen (`npm run billing:preflight`). Aktive Generierungen abschließen lassen; Billing-Schreibzugriffe, Checkout und Webhook-Verarbeitung für die Umstellung pausieren.
2. Vorhandene Basisschemas sicherstellen: `docs/billing-schema.sql`, danach `docs/stripe-webhook-events-schema.sql`.
3. `docs/billing-atomic-migration.sql` ausführen (`npm run billing:migrate` mit `SUPABASE_DB_URL` oder Supabase SQL Editor). **Unmittelbar danach** den dazugehörigen App-Stand deployen, bevor Billing-Schreibzugriffe wieder freigegeben werden. Die alten Schreibpfade sind nach der Migration absichtlich inkompatibel; weder alte noch neue Version dürfen mitten in der Umstellung normalen Traffic verarbeiten.
4. RPCs sind nur für `service_role` ausführbar; den Schlüssel niemals im Browser verwenden.
5. Stripe Live-Webhook: `npm run billing:sync-webhook:live`. Während der Pause fehlgeschlagene Events erneut zustellen. Alte dauerhaft `processing` gebliebene Abo-/Rechnungsereignisse separat prüfen; Token-Käufe verwenden diese Sperre nicht mehr.
6. Smoke-Test: zwei gleichzeitige Generierungen bei knappem Guthaben, zweimal dieselbe Kaufbestätigung, Monatswechsel mit teilweise verbrauchtem Paket, Tarifwechsel und Kündigung. Mit echten getrennten PostgreSQL-Verbindungen zusätzlich die Zeilensperren unter Parallelität prüfen.

SQL-Skript ist wiederholbar; bereits migrierte Guthaben werden nicht erneut initialisiert. Ein App-Rollback alleine ist nach Schemawechsel nicht ausreichend. Die Umstellung daher mit Backup und abgestimmter Wiederherstellung planen.

## Historische Daten

Der Backfill bewahrt den sichtbaren Restbestand und interpretiert Verbrauch nach dem Prinzip „Monatskontingent zuerst“. Beispiel: Start-Kontingent 1200, Gesamtbudget 1700, Verbrauch 1400 ergibt 300 verbleibende Zusatz-Tokens.

Aus den bisherigen Summen ist nicht rekonstruierbar, welche gekauften Tokens in früheren Monaten schon verbraucht und irrtümlich erneut verfügbar gemacht wurden. Der Fix zieht solche historischen Überbestände nicht automatisch ein. Ebenso beweisen alte Einträge in `billing_token_pack_grants` wegen des bisherigen zweistufigen Ablaufs keine erfolgreiche Gutschrift. Diese Fälle anhand vorhandener Protokolle/Zahlungen separat abstimmen; alte Claims nicht pauschal löschen, sonst drohen Doppelgutschriften.

## Tests und Grenzen

Verifikation am 15.09.2026: `npm test` mit 172 bestandenen Tests in 31 Dateien; davon 26 neue Billing-Tests. TypeScript-Gesamtprüfung weiterhin mit neun Fehlern außerhalb der geänderten Billing-Dateien: `hyperrealistic.ts`, `prompt-builders.test.ts`, `beer-create-panel.tsx`, `supabase/env.test.ts`. Diese Dateien wurden für den Billing-Fix nicht verändert.

Neue Tests: `atomicBilling.test.ts`, `billingRoutes.test.ts`, `store.test.ts`, `stripeSync.test.ts`. Die SQL-Tests führen die tatsächliche Migration und Funktionen mit `@electric-sql/pglite` (nur Dev-Abhängigkeit) in lokalem PostgreSQL aus, einschließlich Rollback mit künstlichem DB-Fehler und Berechtigungsprüfung. Es werden keine Produktiv-Zugangsdaten benötigt.

PGlite serialisiert seine Verbindungen; Promise.all deckt die Aufrufkombinationen ab, ersetzt aber keinen Lasttest mit mehreren echten PostgreSQL-Verbindungen. Die SQL-Funktionen selbst verwenden Zeilensperren.

Diese Änderung führt kein auftragsbezogenes Reservierungs-/Refund-Ledger ein. Die bestehende Generierungslogik kann weiterhin Provider-Aufrufe vor der endgültigen Abbuchung starten. Rückerstattungen per bloßem Betrag sind weiterhin nicht über eine Task-ID dedupliziert und ordnen periodenübergreifende Fehler nicht ihrem ursprünglichen Verbrauch zu. Diese weitergehenden Generierungsfälle sollten separat mit einem Task-Ledger umgesetzt werden; „atomar“ bedeutet hier keine vollständige Exactly-once-Verarbeitung aller Generierungsabläufe.

Keine Produktionsmigration, kein Deployment und kein Commit durch diese Änderung.
