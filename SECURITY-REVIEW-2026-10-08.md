# Sicherheitsprüfung vom 8. Oktober 2026

## Umfang und Ergebnis

Erste Prüfung des aktuellen Arbeitsstands: gemeinsame API-Guards, Anmeldung/2FA,
Admin- und Workspace-Zugriff, Session-Reparatur, Medienauslieferung, URL-Abruf,
Paketabhängigkeiten und ausgewählte öffentliche Live-Header. Vorhandene lokale
Änderungen wurden erhalten. Die unten beschriebenen Reparaturen sind lokal und
noch nicht veröffentlicht. Dies ist kein vollständiger Penetrationstest.

## Behobene Befunde

### 1. Herkunftsschutz konnte auf Zielinformationen zurückfallen

`src/lib/security/requestGuards.ts`: Ein nicht erlaubter Referer beendete die Prüfung
nicht. Anschließend konnte ein passender `x-forwarded-host` den Request freigeben.
Diese Proxy-Information beschreibt das Ziel, nicht die Herkunft des Browserrequests.
Auch ohne Origin/Referer genügte dieser Header zuvor. `same-site` akzeptierte zudem
beliebige Geschwister-Subdomains, obwohl die explizite Allowlist nur App und Marketing
vorsieht. Die tatsächliche Ausnutzbarkeit hängt unter anderem von Proxy- und
Cookie-Konfiguration ab; ein erfolgreicher Angriff auf ein Live-Konto wurde nicht getestet.

Reparatur: Origin/Referer werden verbindlich geprüft; fremde Referer werden sofort
abgelehnt. Proxy-Header autorisieren nicht mehr. Ohne diese Herkunftsangaben werden
nur `same-origin` sowie direkte GET/HEAD-Navigationen (`none`) akzeptiert. Die
explizit erlaubten App-/Marketing-Origins und lokale Entwicklung bleiben erlaubt.

### 2. Session-Reparatur ohne Herkunftsschutz

`src/app/api/auth/repair-session/route.ts` konnte eine cookie-authentifizierte Session
erneuern bzw. Metadaten reparieren, ohne den gemeinsamen Herkunftsschutz aufzurufen.
Die Route prüft jetzt die Herkunft vor jedem Zugriff auf die Authentifizierung.

### 3. Aktive Dokumente aus veränderbaren Bildmetadaten

`src/lib/brand/reference-image-store.ts` übernahm einen beliebigen MIME-Typ aus
`user_metadata`; die Referenzbildroute lieferte die zugehörigen Bytes unter diesem
Inhaltstyp auf der App-Origin aus. Nutzer können ihre Auth-Metadaten selbst ändern.
Damit war die Auslieferung von HTML/SVG als angebliches Referenzbild möglich.
Ein Session-Diebstahl wurde nicht demonstriert; CSP und Authentifizierung begrenzen
die tatsächlichen Folgen.

Reparatur: Referenzen erlauben ausschließlich JPEG, PNG, WebP, GIF und AVIF.
Die Referenzbildroute und der KIE-Medienproxy liefern außerdem `nosniff` und eine
restriktive Dokument-CSP (`default-src 'none'; sandbox`). Die separate, bereits lokal
begonnene nonce-basierte Middleware-Umstellung gehört nicht zu diesem Sicherheitscommit.

### 4. Verwundbare Paketversionen und Produktionsumfang

Aktualisiert: `sharp` 0.35.4 → 0.35.5, MCP SDK 1.30.0 → 1.32.1 und
`source-map-js` 1.2.1 → 1.2.2. Lockfile aktualisiert, Mindestversion für `sharp`
angehoben. `shadcn` ist ein CLI für die Entwicklung; im App-Code wurden keine
Imports gefunden. Es ist jetzt eine Entwicklungsabhängigkeit.

`npm audit --omit=dev`: nach den Änderungen keine gemeldeten Schwachstellen.
Das vollständige Audit meldet weiterhin acht Einträge mit Schweregrad high in
Entwicklungsabhängigkeiten. Die Umklassifizierung behebt diese Meldungen nicht;
sie entfernt den CLI-Abhängigkeitsbaum aus dem Produktionsumfang. Kein erzwungenes
Major-Downgrade des CLI wurde vorgenommen.

## Live-Beobachtungen

- `https://app.brewai.de/anmelden`: HTTP 200, CSP, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff` und HSTS vorhanden. Die Live-CSP erlaubt noch
  Inline-Skripte; der lokale Arbeitsstand enthält bereits eine nonce-basierte CSP.
- OPTIONS an `https://auth.brewai.de/auth/v1/token?grant_type=password` mit einer
  fremden Origin: HTTP 200, `Access-Control-Allow-Origin: *`, kein
  `Access-Control-Allow-Credentials`. Die im Screenshot behauptete reflektierte
  Origin plus Credentials wurde mit dieser Anfrage nicht reproduziert.
- OPTIONS an `/api/auth/status`: HTTP 204, keine Access-Control-Allow-Header.

Diese Beobachtungen sind Momentaufnahmen ausgewählter Endpunkte und Methoden.
Es wurden keine Benutzerpasswörter, Sessions oder fremde Kundendaten verwendet.

## Verifikation

- 27 gezielte Tests bestanden: Sicherheitshelfer, Herkunfts-Bypässe,
  Auth-/Workspace-Guards, Bildmetadaten und reale Route-Handler mit gemockter Auth.
- ESLint für die geänderten TypeScript-Dateien: bestanden.
- `tsc --noEmit`: bestanden.
- Gesamttestlauf: 555 bestanden, vier fehlgeschlagen in
  `src/lib/ai/imageRejection.test.ts` (erwartet HTTP 202, erhalten HTTP 422).
  Diese Tests liegen außerhalb der hier geänderten Dateien; ein vollständiger
  Vorher-Nachher-Nachweis für diese Fehler wurde nicht durchgeführt.
- `git diff --check`: bestanden.

## Noch zu prüfen

Die tatsächlich ausgerollten Datenbank-/Storage-Policies, Grants und serverseitigen
Funktionen wurden nicht vollständig geprüft. Die Supabase-Verbindung listet Projekte,
aber anhand der lokalen Custom-Domain `auth.brewai.de` konnte kein Projekt eindeutig
zugeordnet werden; daher wurden keine fremden Projekte untersucht oder geändert.
Offen sind außerdem ein authentifizierter Test mit getrennten Konten/Teamrollen,
Login-/Reset-Flows im Browser und die Verifikation nach einem Deployment.

Technischer Hintergrund zur Herkunftsprüfung:
https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF
