# Go-Live-Fixes – Rollout und Abnahme

Stand: 15.09.2026. Dieses Paket ändert Authentifizierung, Teamzuordnung, Tokenbuchungen und Speicherzugriffe. **Code und Datenbank gemeinsam ausrollen.** Ein erfolgreicher lokaler Build ist keine Produktionsfreigabe.

Produktionsstand: `billing_access_hardening` wurde am 15.09.2026 als isolierter Sofort-Fix auf Supabase-Projekt `lutmsbxcjmocftiovwfs` angewendet und verifiziert. Die übrigen Migrationen und die Datenübernahme sind noch nicht produktiv angewendet.

## Implementiert

- Plattformrollen kommen aus `app_metadata`, nicht aus editierbaren Profilfeldern. Für `OWNER_EMAILS` muss die E-Mail bestätigt sein; serverseitige Ownerprüfungen verwenden keinen fünfminütigen Rechtecache mehr. Einrichtungsskript und Adminverwaltung schreiben die neue Rollenquelle.
- Geschützte API-Routen prüfen die 2FA des tatsächlich angemeldeten Nutzers. Anschließend wird für Ressourcen die serververwaltete Teamzuordnung aufgelöst.
- Teammitgliedschaften, Einladungen und Rollen liegen in geschützten Tabellen. Einladungen laufen nach sieben Tagen ab, werden als Hash gespeichert und können nur mit der bestätigten eingeladenen E-Mail angenommen werden. Mitgliedschaft ist zunächst auf ein Team pro Konto begrenzt. Ein eigenes laufendes Abo muss vor dem Teambeitritt beendet werden.
- Tariflimits von 1/3/10 Plätzen zählen den Inhaber mit. Viewer lesen; Editor bearbeiten/generieren; Admin verwalten zusätzlich normale Teammitglieder. Nur der Inhaber ernennt/ändert/entfernt Teamadministratoren und verwaltet die Abrechnung. Nach Tarifverkleinerung werden überzählige Plätze serverseitig gesperrt.
- Jahresabos bekommen monatliche Budgetperioden unabhängig von der Rechnungsfrequenz. Berechnung erfolgt vor Budgetanzeige und Verbrauch. Monatsanker bleiben auch bei kurzen Monaten stabil.
- Resttokens bleiben zusätzlich bis 30/60/90 Tage nach Ende ihrer ursprünglichen Budgetperiode gültig. Verbrauch erfolgt zuerst aus den zuerst ablaufenden Guthaben. Gekaufte Pakete laufen nicht ab. Rückerstattungen gehen in dieselben ursprünglichen Guthaben zurück; ein altes Guthaben erhält dadurch kein neues Ablaufdatum.
- Jede Bild-/Videoerstellung reserviert Tokens vor dem Bild-/Videoprovider. Job und Abbuchung sind atomar. Gleicher Auftragsschlüssel belastet nicht erneut. Der aktive Bildclient verwendet denselben Schlüssel bei Netzwerkwiederholungen.
- Erfolgreiche Zwischenbilder und abgeschlossene Ergebnisse werden am Job gespeichert. Kie-Tasks gehören serverseitig einem Nutzer/Workspace; Polling liest keine Erstattungsbeträge aus Profilmetadaten mehr. Ein Erstattungsabschluss ist wiederholbar, ohne doppelt gutzuschreiben.
- Fehlgeschlagene oder abgebrochene Aufträge werden unabhängig vom geöffneten Browser nachbearbeitet. Bei synchronen Jobs ohne Abschluss werden nach 30 Minuten gespeicherte Ergebnisse abgerechnet, übrige Reservierungen freigegeben. Es werden keine unbelegten neuen Provideraufrufe gestartet.
- Subscription-Checkout wird je Kunde serialisiert und mit Stripe-Idempotenz abgesichert. Vorhandene Abos werden in Stripe geprüft. `unpaid`/`incomplete`/`past_due` geben keine Generierung frei; es gibt derzeit keine implizite Kulanzfrist.
- Webhook-Claims bestätigen aktive Bearbeitung nicht voreilig. Ein nach Prozessabbruch liegengebliebener Claim kann nach zehn Minuten erneut verarbeitet werden. Subscription-Updates lesen den aktuellen Stripe-Zustand.
- Bibliotheksdaten liegen in geschützten Einzelzeilen, nicht in öffentlichen JSON-Dateien. Gleichzeitige neue Einträge überschreiben nicht mehr den gesamten Index. Das Zwölf-Einträge-Limit entfällt; Datenbankabfragen werden seitenweise gelesen.
- Uploads liefern einstündige signierte URLs. Bekannte eigene Storage-URLs werden beim Laden erneuert. Nexts öffentlicher Image-Optimizer ist für diese privaten Bilder ausgeschaltet, damit sein Cache die Signaturfrist nicht verlängert.
- Instagram-Zugangsdaten liegen in einer ausschließlich serverlesbaren Tabelle. Alte editierbare Verbindungstokens werden nicht als vertrauenswürdige Anmeldedaten übernommen.
- Website-/Referenzdownloads validieren öffentliche Zieladressen und binden den tatsächlichen Socket an das geprüfte DNS-Ergebnis. Weiterleitungen werden erneut geprüft. Browser-Unterrequests werden darüber vermittelt; Service Worker und WebSockets sind gesperrt. Zeit-/Größenlimits gelten während des Downloads. Fehlendes Chromium verwendet den abgesicherten HTML-Fallback.
- Bild-, Video-, Etikett- und Brandfont-Downloads verwenden dieselbe DNS-gebundene Netzwerkgrenze. Gängige öffentliche IPv6-Adressen bleiben erreichbar; lokale, gemappte und reservierte Bereiche werden abgewiesen.
- Kostenpflichtige Claude-Hilfsfunktionen (Prompt, Motivverbesserung, Social-Copy und Assistent) setzen ebenfalls 2FA, passende Teamrolle und ein aktives Workspace-Abo voraus.
- Kontolöschung ist wiederaufnehmbar. Billingfehler verhindern voreiligen Erfolg. Stripe-Abos und bekannte nutzereigene Storagepräfixe werden vor Auth-Löschung bereinigt; abhängige neue Tabellen löschen per Fremdschlüssel mit. Finanzbelege verbleiben im externen Abrechnungssystem.
- Produktions-Rate-Limits sperren bei fehlendem/ausgefallenem Upstash. Nur lokale Entwicklung darf auf Prozessspeicher ausweichen. Gleiches gilt für fehlende Team-/Löschtabellen.
- Abhängigkeiten wurden aktualisiert. CI prüft Installation, Lint, Tests, TypeScript, Build und Produktionsabhängigkeiten. Ein weiterer Workflow stößt die Jobnachbearbeitung alle 15 Minuten an.

## 1. Release vorbereiten

1. Einen festen Release-Commit auswählen. Während der Arbeiten liefen parallel andere Commits ein; die Freigabe muss auf einem festgeschriebenen Stand erfolgen.
2. DB und Storage sichern und eine Wiederherstellungsmöglichkeit verifizieren.
3. Schreibende Zugriffe/Generierung während Migration und Deployment pausieren. Alte Kie-Aufträge abschließen oder anhand vertrauenswürdiger Belege manuell abgleichen. Editierbare `kie_pending_task_billing`-Metadaten dürfen keine automatische Gutschrift auslösen.
4. Bestehende Owner-/Adminidentitäten anhand vertrauenswürdiger Betreiberunterlagen prüfen. Nur diese in `app_metadata.role` setzen. **Nicht sämtliche alten `user_metadata.role`-Werte kopieren.** Das aktualisierte Owner-Einrichtungsskript darf nur mit geprüften Owner-E-Mails benutzt werden.

## 2. SQL in dieser Reihenfolge anwenden

Voraussetzungen sind die bereits vorhandenen `billing-schema.sql`, `stripe-webhook-events-schema.sql` und `billing-atomic-migration.sql`. Bereits angewandte Basismigrationen nicht unbedacht als Reparatur erneut starten.

Neue Migrationen, jeweils aus `docs/`:

1. `billing-access-hardening-migration.sql`
2. `go-live-security-migration.sql`
3. `generation-jobs-migration.sql`
4. `billing-periods-migration.sql`
5. `generation-result-billing-migration.sql`
6. `workspaces-migration.sql`
7. `account-deletion-migration.sql`
8. `checkout-lock-migration.sql`
9. `webhook-recovery-migration.sql`

Die neuen Tabellen und RPCs sind für `anon`/`authenticated` gesperrt. Der Server verwendet den Service-Role-Zugang. In einer Staging-Datenbank mit echten Supabase-Rollen noch einmal negativ testen; PGlite ersetzt keine vollständige Supabase-Instanz.

## 3. Bestandsdaten übernehmen

`scripts/go-live-data-migration.mjs` wurde vorbereitet, aber nicht gegen Produktion ausgeführt. Zugangsdaten nur als Umgebungsvariablen bereitstellen; keine Schlüssel in Shellargumente kopieren.

Im Projektordner zunächst nur prüfen:

```powershell
node --env-file=.env.local scripts/go-live-data-migration.mjs
```

Erst nach Prüfung des Zielprojekts und Sicherung anwenden:

```powershell
node --env-file=.env.local scripts/go-live-data-migration.mjs --apply
```

Das Skript übernimmt bestehende Bibliotheksindizes in die geschützte Tabelle, lässt die alten Indexdateien während der Abnahme als Rollback-Kopie liegen, bereinigt Profilmetadaten und setzt den Bilder-Bucket auf privat. Es bearbeitet nur Konten mit BrewAI-Billingdaten, BrewAI-Dashboardmetadaten, Brauerei-Metadaten oder einem alten Medienindex. Bestehende Abonnements ohne Monatsanker werden anhand ihres Stripe-Zeitraums initialisiert; historische Planänderungen oder verlorene Guthaben werden nicht erfunden. Sichtbare Altguthaben werden durch die SQL-Migration erhalten.

Wichtige Übergänge:

- Alte Teamlisten bleiben als `legacyTeamMembers` für den organisatorischen Abgleich erhalten. Sie werden **nicht** automatisch zu berechtigten Mitgliedschaften. Bestandsmitglieder über den neuen Annahmeablauf erneut einladen.
- Instagram muss neu verbunden werden. Früher im Browser sichtbare Provider-Tokens gegebenenfalls auch beim Provider widerrufen/ersetzen; das Entfernen aus Metadaten widerruft keine bereits kopierte Zeichenfolge.
- Das Skript stoppt bei alten ausstehenden Kie-Buchungen. Diese vor der Umstellung abgleichen.
- Bereits früher aus einem Zwölf-Einträge-Index entfernte Titel/Prompts können aus diesem Index nicht rekonstruiert werden. Die zugrunde liegenden Storageobjekte sind separat zu prüfen.
- Bestehende öffentliche Bildlinks funktionieren nach Privatstellung nicht mehr als dauerhafte externe Freigabelinks. Gewollte öffentliche Freigaben müssen separat bereitgestellt werden.
- Die Schritte sind wiederholbar, aber kein systemübergreifender Rollback in einer einzigen Transaktion. Bei Fehlern Migration pausieren, Ursache beheben und sicher fortsetzen. SQL/Code nicht auseinanderlaufen lassen.

## 4. Produktionskonfiguration

- Supabase-URL, Anon-/Publishable-Key und **serverseitiger** Service-Role-Key.
- `OWNER_EMAILS` und geprüfte `app_metadata.role`-Zuweisungen.
- Stripe-Live-Key, Live-Preis-IDs und Webhooksecret; Monats-/Jahrespreise gegen die sichtbaren Angebote prüfen.
- Upstash-URL und Token. Ohne diese liefern geschützte Routen in Produktion bewusst 503 statt unbegrenzt weiterzuarbeiten.
- `CRON_SECRET` im Hosting und als GitHub-Secret; GitHub-Variable `APP_URL` auf die Produktionsorigin setzen. Reconcile-Workflow einmal manuell ausführen und Benachrichtigungen bei Fehlern aktivieren.
- Resend-Absender, Zustellbarkeit, Supabase-Redirects und 2FA-Konfiguration mit externen Testadressen prüfen.
- Private Storagekonfiguration, signierte Downloads, Brandfonts und Referenzbilder testen. Egress zusätzlich im Hosting beschränken, insbesondere für Chromium.
- Providerberechtigungen, Kostenlimits und produktiver Modellzugang. Lokale Tests haben keine zahlungspflichtigen Provideraufrufe ausgeführt.

## 5. Verbindliche Staging-/Releaseabnahme

- Zwei gewöhnliche Kundenkonten plus Team-Viewer/Editor verwenden; Ownerkonten umgehen Billing und sind dafür ungeeignet.
- Metadatenrolle verändern: keine Adminrechte/Gratis-Tokens. API mit Login, aber ohne 2FA: 403.
- Team einladen/annehmen, falsche E-Mail, abgelaufene Einladung, Viewer-Schreibzugriff, Rolle ändern/entfernen und Tarif verkleinern.
- Getrennte Kunden sehen keine fremden Marken/Bibliotheken/Jobs. Teammitglieder sehen die gemeinsame Marke, Inhalte und dasselbe Guthaben.
- Jahresabo über Monatsgrenzen, 30/60/90-Tage-Ablauf, Paketkauf, Upgrade/Downgrade, Kündigung/Wiederabschluss und unbezahlte Rechnung.
- Zwei konkurrierende Generierungen mit knappem Guthaben, identischer Auftragsschlüssel, Providerfehler, Teilbilder, Browserabbruch, Cronabschluss und Erstattung nach Periodenwechsel.
- Zwei Checkouttabs, noch offener anderer Tarif, bereits bestehendes Abo, Webhookwiederholung und Prozessabbruch nach Claim. Ein offener Checkout bindet den Tarif für maximal 24 Stunden; ein anderer Tarif wird bis dahin abgewiesen.
- Kontolöschung mit Medien, Team und Abo; absichtlicher Stripe-/Storagefehler; erneute Ausführung ohne doppelte Abrechnung oder voreiligen Erfolg.
- Smartphone/Desktop, Fehlermeldungen, Bilddownload, Formularbedienung, Einladung und E-Mails im Browser prüfen.

## Weiterhin externe Freigabepunkte

Rechtstexte/Dienstleistervereinbarungen, Backup-Restore-Test, Hosting-/Netzwerkgrenzen, Stripe-Steuer-/Preiswerte, E-Mail-Zustellung, Meta-Appfreigabe und echte Produktions-End-to-End-Tests bleiben gesonderte Freigabepunkte. Diese Arbeit behauptet dafür keine erfolgreiche Prüfung.

## Lint-Umfang

`npm run lint` prüft jetzt aktiven Code in `src` und `scripts`, nicht archivierte Vorschaupakete. Die React-Compiler-Hinweise `set-state-in-effect` und `preserve-manual-memoization` bleiben sichtbar als Warnungen. Korrektheitsregeln wie Hooks, Refzugriffe und Zugriff vor Deklaration bleiben Fehler. Bestehende Warnungen sind damit nicht als behobene UX-Probleme zu verstehen.
