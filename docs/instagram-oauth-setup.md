# Instagram OAuth — Setup (Meta + Vercel)

Markenprofil-Scan über verbundenes Instagram Business/Creator-Konto (Option A).

**Produktions-Callback (exakt so in Meta eintragen):**

```
https://app.brewai.de/api/brand/instagram/callback
```

**Lokal (Dev-Port 3001):**

```
http://localhost:3001/api/brand/instagram/callback
```

---

## Teil A — Meta Developer Console

### A1. Voraussetzungen (Instagram-Seite)

1. Instagram-Konto als **Business** oder **Creator** (Einstellungen → Konto → Kontotyp).
2. Mit einer **Facebook-Seite** verknüpft (Meta Business Suite / Seiten-Einstellungen).
3. Du bist **Admin** der Facebook-Seite und hast Zugriff auf das Instagram-Konto.

Ohne gekoppelte Facebook-Seite kommt nach OAuth der Fehler: *„Kein Instagram Business/Creator-Konto gefunden“*.

### A2. App anlegen

1. Öffne [developers.facebook.com/apps](https://developers.facebook.com/apps).
2. **App erstellen** → Use case: **Andere** oder **Business** (je nach Meta-Oberfläche).
3. App-Name z. B. `BrewAI`, Kontakt-E-Mail deiner Wahl.
4. App erstellen und im Dashboard öffnen.

Notiere sofort:

| Feld | Wo in Meta |
|------|------------|
| **App-ID** | App-Dashboard → Einstellungen → Basis |
| **App-Geheimnis** | Einstellungen → Basis → App-Geheimnis anzeigen |

→ Diese Werte werden `META_APP_ID` und `META_APP_SECRET` in Vercel.

### A3. Produkte hinzufügen

Im App-Dashboard unter **Produkte hinzufügen**:

1. **Facebook Login for Business** (oder **Facebook Login**) → **Einrichten**.
2. **Instagram Graph API** → **Einrichten** (falls separat angeboten).

### A4. Facebook Login — Redirect URIs

1. **Facebook Login** → **Einstellungen** (Settings) → **Client OAuth Settings**.
2. **Valid OAuth Redirect URIs** — beide Zeilen eintragen (eine pro Zeile):

   ```
   https://app.brewai.de/api/brand/instagram/callback
   http://localhost:3001/api/brand/instagram/callback
   ```

3. Speichern.

Wichtig: Kein trailing slash, exakt `https://app.brewai.de`, Pfad `/api/brand/instagram/callback`.

### A5. App-Domains (optional, empfohlen)

**Einstellungen → Basis:**

- **App-Domains:** `app.brewai.de`
- **Datenschutzrichtlinien-URL:** z. B. `https://brewai.de/datenschutz` (falls vorhanden)
- **Nutzungsbedingungen-URL:** optional

### A6. Berechtigungen (Scopes)

Die App nutzt diese Scopes (bereits im Code):

- `instagram_basic`
- `pages_show_list`
- `pages_read_engagement`

Unter **App Review → Berechtigungen und Features** prüfen, dass diese Permissions zur App gehören.

**Entwicklung / Test (ohne App Review):**

- App-Modus: **Entwicklung** (Development).
- Unter **Rollen → Testnutzer** oder als **App-Admin** kannst du dich selbst testen.
- Nur Nutzer mit Rolle (Admin, Developer, Tester) oder Seiten, die du verwaltest, funktionieren im Dev-Modus zuverlässig.

**Produktion (Go-live für alle Kunden):**

- App auf **Live** schalten.
- App Review für die drei Permissions beantragen (Use Case: Markenprofil aus eigenen IG-Posts für KI-Bildgenerierung).
- Bis zur Freigabe: Instagram-Tab zeigt ggf. OAuth-Fehler für normale Endnutzer.

### A7. Instagram-Konto der App zuweisen (falls gefordert)

In neueren Meta-Oberflächen:

1. **Instagram Graph API** → verknüpftes Instagram-Testkonto oder Business-Konto hinzufügen.
2. Sicherstellen, dass die Facebook-Seite mit IG in **Business Suite** sichtbar ist.

### A8. Kurz-Checkliste Meta

- [ ] App-ID & App-Geheimnis notiert
- [ ] Facebook Login produkt aktiv
- [ ] Redirect URI Produktion + localhost:3001 eingetragen
- [ ] Instagram Business/Creator + Facebook-Seite verknüpft
- [ ] Testnutzer / Admin-Rolle für dich gesetzt (Dev-Modus)
- [ ] Für Go-live: App Review geplant

---

## Teil B — Vercel (Umgebungsvariablen)

Die Vercel CLI ist lokal nicht eingeloggt — Env-Variablen setzt du im **Vercel Dashboard** oder nach `vercel login` per CLI.

### B1. Variablen (Production)

Vercel → Projekt **evglab-app** → **Settings** → **Environment Variables**

| Name | Wert | Environment |
|------|------|-------------|
| `META_APP_ID` | App-ID aus Meta (Ziffern) | **Production** |
| `META_APP_SECRET` | App-Geheimnis aus Meta | **Production** |
| `META_GRAPH_API_VERSION` | `v22.0` (optional, Default im Code) | Production |
| `NEXT_PUBLIC_APP_BASE_URL` | `https://app.brewai.de` | **Production** (prüfen, nicht überschreiben falls schon gesetzt) |

`META_APP_SECRET` nur als **Secret** markieren (Standard in Vercel).

**Preview / Development (optional):**

- Preview: gleiche Meta-App nur sinnvoll, wenn Preview-URL als Redirect in Meta eingetragen ist (Vercel-Preview-URLs ändern sich → meist **nur lokal + Production** testen).
- Development (lokal): Werte in `.env.local` (nicht committen).

### B2. Lokale `.env.local`

Im Projektroot `evglab-app/.env.local`:

```env
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001
META_APP_ID=deine_meta_app_id
META_APP_SECRET=dein_meta_app_geheimnis
META_GRAPH_API_VERSION=v22.0
```

Dev-Server neu starten nach Änderung: `npm run dev` (Port **3001**).

### B3. Vercel CLI (nach Login)

```powershell
cd c:\Users\erikv\Documents\GitHub\evglab-app
vercel login
vercel link
```

Secrets setzen (interaktiv — Werte aus Meta einfügen):

```powershell
vercel env add META_APP_ID production
vercel env add META_APP_SECRET production
vercel env add META_GRAPH_API_VERSION production
```

Prüfen (zeigt nur Namen, keine Secret-Werte):

```powershell
vercel env ls
```

### B4. Redeploy

Nach neuen Env-Variablen **Production-Deployment neu auslösen**:

- Vercel Dashboard → Deployments → letztes Deployment → **Redeploy**, oder
- Leerer Commit / Push auf Production-Branch.

Ohne Redeploy kennt die laufende Instanz die neuen Variablen nicht.

### B5. Verifikation in Produktion

1. `https://app.brewai.de/dashboard?tab=brand` → **Marke einlesen** → Tab **Instagram**.
2. Kein Hinweis *„noch nicht konfiguriert“* → Env ist geladen.
3. Optional API (eingeloggt): `GET /api/brand/instagram/status` → `"configured": true`.
4. **Instagram verbinden** → Meta-Login → Redirect zurück mit `instagram=connected`.
5. **Posts analysieren** → Review → **Profil aktivieren**.

### B6. Kurz-Checkliste Vercel

- [ ] `META_APP_ID` in Production gesetzt
- [ ] `META_APP_SECRET` in Production gesetzt (Secret)
- [ ] `NEXT_PUBLIC_APP_BASE_URL=https://app.brewai.de` in Production
- [ ] Redeploy durchgeführt
- [ ] OAuth-Test auf app.brewai.de erfolgreich

---

## API-Endpunkte (Referenz)

| Methode | Pfad | Zweck |
|---------|------|--------|
| GET | `/api/brand/instagram/connect?returnTo=...` | OAuth-Start |
| GET | `/api/brand/instagram/callback` | Meta Redirect |
| GET | `/api/brand/instagram/status` | Verbindungsstatus |
| POST | `/api/brand/instagram/scan` | Posts analysieren |
| POST | `/api/brand/instagram/disconnect` | Trennen |

Tokens: `user_metadata.dashboard.instagramConnection` (Supabase Admin API).

---

## Fehlerbehebung

| Symptom | Lösung |
|---------|--------|
| Tab: *noch nicht konfiguriert* | `META_APP_ID` / `META_APP_SECRET` fehlen oder kein Redeploy |
| Meta: *Redirect URI mismatch* | Callback-URL in Meta exakt wie oben; `NEXT_PUBLIC_APP_BASE_URL` prüfen |
| *Kein Instagram Business-Konto* | IG mit Facebook-Seite verknüpfen |
| OAuth ok, Scan schlägt fehl | Mind. 3 Bild-Posts auf IG; `ANTHROPIC_API_KEY` in Vercel prüfen |
| Nur Admins können verbinden | App noch im **Entwicklungsmodus** → Live schalten oder Tester-Rolle |
| Token abgelaufen | Im Tab erneut **Instagram verbinden** |
