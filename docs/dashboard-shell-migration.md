# Dashboard-Shell-Migration (Shadcn Admin) — Korrekturstand

## Referenzprüfung

- ZIP `next-shadcn-admin-dashboard-v1.zip` und `_template_dashboard/` sind inhaltlich identisch (323 Dateien; SHA256 von `package.json`, Default-Page, Layout, `globals.css` stimmen überein).
- Template-Referenz lokal: `http://localhost:3010` (`turbopack.root` isoliert, damit keine Parent-Middleware greift).
- Standardroute Original: `/dashboard` → `/dashboard/default`.

## Migrierte Seiten (Inhalte, nicht nur Shell)

| Seite | Status | Basis |
|---|---|---|
| Übersicht `/dashboard` | neu: `AdminHomeView` | Template MetricCards-/Card-Layout + echte Summary/Media-Daten |
| Team `/dashboard/team` | neu: `AdminTeamView` | Card/Input/Select/Badge + Team-API |
| Einstellungen `/dashboard/settings` | neu: `AdminSettingsView` | Card/Input/Switch + Settings-API |
| Abonnement `/dashboard/pricing` | neu: `AdminPricingView` | Card/Badge/Progress/Switch + Stripe-Checkout |
| Mediathek `/dashboard/media` | Chrome auf Template-Primitives | File-Manager-Kopfzeile, Cards, Job-Karten, Composer-Dock; Logik unverändert |
| Bilder erstellen `/inhalte-erstellen` | Landing/Dock ohne Claude-Wrapper | Card + bestehende Composer-Logik |
| Markenprofil `/dashboard/brand` | teilweise | Logik/View noch `BrandProfileView` (nicht voll auf Template-Primitives umgeschrieben) |

## Entfernt aus der Navigation

Chat, E-Mail, Rollen, Profil (waren UI-Stubs ohne Backend).

## Übernommene Original-Bausteine

- Shell: `SidebarProvider`, `AppSidebar`-Muster, Sticky-Header `h-12`, Search/Layout/Theme/Account
- UI: `Card`, `Button`, `Badge`, `Input`, `Label`, `Select`, `Switch`, `Checkbox`, `Progress`, `Skeleton`, `Separator`
- Theme: `admin-theme.css` + Presets; Geist/Admin-Tokens
- Content-Padding-Muster `data-content-padding="false"` für Full-Bleed (Mediathek)

## Bewusst noch Abweichungen

1. **Markenprofil:** weiterhin eigene `BrandProfileView`/Setup-Modal — fachlich stark BrewAI-spezifisch; noch nicht 1:1 Template-Formulare.
2. **Composer (`claude-style-chat-input`):** Funktionalität BrewAI; Optik noch teilweise `--cc-*` / alte Menu-Trigger — Landing/Dock-Rahmen ist Template-Card, innere Leiste noch nicht vollständig shadcn.
3. **Studio-CSS** (`studio-*.css`) bleibt global importiert für Restflächen (Brand-Choice, Settings-Reste, Onboarding-Checklist). Nicht blind gelöscht.
4. **Keine authentifizierte Pixel-1:1-Abnahme** der BrewAI-Dashboard-Inhalte ohne Session: öffentlicher Zugriff landet hinter Auth. Template-Referenz-Screenshot unter `docs/visual-qa/`.

## Checks

- `tsc` auf Migrationspfaden: keine neuen Fehler in Admin-Views/Shell/Media
- Vitest: `start-studio-generation`, `instagram-oauth-state` — 9 Tests grün
- Keine kostenpflichtige Generierung ausgeführt

## Screenshots

- `docs/visual-qa/template-default-desktop.png` — Original `/dashboard/default` @ 1440×900
- `docs/visual-qa/brewai-dashboard-desktop.png` — BrewAI `/dashboard` (Auth-Gate / Session je nach Cookie)

## Keine Aussage „1:1 umgesetzt“

Solange Markenprofil, Composer-Innenleben und verbleibendes Studio-CSS existieren, ist die Migration **fortgeschritten, aber nicht pixelidentisch abgeschlossen**.
