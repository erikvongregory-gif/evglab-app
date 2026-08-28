# BrewAI Studio — Handoff (final)

Stand: 28.08.2026 · Design-Version FINAL · verbindliche Quelle: **BrewAI Studio Final.dc.html**

Bei Widersprüchen zu älteren Zusammenfassungen gilt ausschließlich dieses Dokument und die Datei
`BrewAI Studio Final.dc.html`. **Nicht mehr gültig:** Playfair Display, Inter, `#0F0603`, `#D4AF37`,
sowie die Dateien v1 / v2 / v3 und „Style Options".

---

## 1 Design-Tokens

### Flächen
```
--bg    #0F0906   App-Grund
--s1    #16100B   Inhaltsfläche
--s2    #1E1710   Karte
--s3    #271E16   Feld / Hover
--s4    #332618   Hover erhöht
--line  #2E2418   Divider
--line2 #3D3021   Border aktiv
```

### Text
```
--t1 #F3EDE4  Primär   (14,6:1)
--t2 #B3A694  Sekundär (7,4:1)
--t3 #7E7263  Muted / Labels (4,6:1)
```

### Akzent (Bernstein / Gold) — einziger Akzent
```
--ac       #C9A24D            Primär
--ac-2     #DDBA6A            Hover
--ac-3     #A9853A            Active
--ac-ink   #1A1207            Text auf Gold (nie Weiß)
--ac-tint  rgba(201,162,77,.10)  Selected-Fläche
--ac-tint2 rgba(201,162,77,.20)  Logo-Fläche
--ac-line  rgba(201,162,77,.28)  Selected-Border
```

### Status
```
--ok   #6FA96F   Success
--warn #DE8F3C   Warning
--err  #D0604C   Error
--info #6E93B8   Information
chart-2 #6B5B45  zweite Diagrammreihe (Videos)
Tints jeweils rgba(...,.14)
```

### Geometrie
```
Radius        6 (klein) · 8 (Button/Feld) · 12 (Karte) · 100 (Pill)
Spacing       4 6 8 12 16 20 24 32 48
Sidebar       236 px offen / 62 px eingeklappt
Topbar        60 px (mobil 54 px) · Bottom-Nav 62 px
Content       max 1240 px · Formular max 660 px
Karte         Padding 18/20 (kompakt 13/15) · Gap 12 px
Schatten      nur Modal (0 24 64 rgba(0,0,0,.55)) und Toast (0 12 32 rgba(0,0,0,.45))
```

## 2 Typografie

| Rolle | Wert |
|---|---|
| UI-Schrift | **Work Sans** 400 / 500 / 600 / 700 |
| Zahlen, Mono-Labels, IDs | **IBM Plex Mono** 400 / 500 / 600 |
| Seitenüberschrift | 22 px / 600 / -0.01em |
| Login-Headline | 26 px / 600 |
| Kennzahl | 26 px / 600 / -0.02em |
| Kartenüberschrift | 14 px / 600 |
| Fließtext | 13 px / 400 / 1.6 |
| Tabelleninhalt | 12,5 px / 400–500 |
| Hilfstext | 11,5 px / 400 |
| Label (Mono, uppercase) | 10 px / 500 / .12em |
| Tabellenkopf (Mono) | 9,5 px / 500 / .12em |
| Button | 12,5 px / 500–600 |

## 3 Komponenten

Buttons (Primary, Secondary, Ghost, Danger, Icon, Loading, Disabled) · Eingabefeld · Textarea ·
Select/Dropdown · Checkbox · Radio · Switch · Chips/Filter-Pills · Suchfeld · Tabs (Unterstrich) ·
Status-Badges · Tooltip · Toast · Modal / Bestätigungsdialog · Karte · KPI-Anzeige · Tabelle ·
Pagination · Upload-Bereich · Fortschrittsanzeige (Balken, Ring, Spinner) · Sidebar-Navigation ·
Topbar · Mobile Bottom-Nav + Menü-Sheet · Skeleton-Muster.

Zustände je Komponente (Default, Hover, Active, Focus, Disabled, Loading, Success, Warning, Error):
siehe Prototyp → *Design-System → Komponenten* und *Zustände* (Zustands-Matrix).

### Komponente → Seite
| Komponente | Eingesetzt auf |
|---|---|
| Sidebar, Topbar | alle Desktop-Seiten außer Login |
| Bottom-Nav + Sheet | alle Mobile-Seiten |
| KPI-Karte | Dashboard, Team (Plätze), Abonnement |
| Tabelle + Badge + Pagination | Dashboard, Team, Abrechnung, Mediathek |
| Motiv-Karte (Grid) | Mediathek, Bilder Erstellen |
| Formularblock | Bilder Erstellen, Markenprofil, Einstellungen, Login |
| Tabs | Einstellungen, Design-System |
| Modal / Dialog | Team, Mediathek, Abonnement, Einstellungen |
| Toast | global |
| Zustandsmuster | Dashboard, Bilder Erstellen, Mediathek, Team, Einstellungen |

## 4 Routen

| Route | Seite | Zustände | Rollen |
|---|---|---|---|
| `/login` | Anmelden | Default, Fehler, Laden | öffentlich |
| `/dashboard` | Dashboard | Normal, Laden | alle |
| `/create/image` | Bilder Erstellen | Normal, Laden, Fehler | Admin, Editor |
| `/media` | Mediathek | Normal, Laden, Leer, Fehler, Keine Rechte | alle (gefiltert) |
| `/brand` | Markenprofil | Normal, Warnung | Admin |
| `/team` | Teamverwaltung | Normal, Laden, Fehler, Keine Rechte | Admin |
| `/settings` | Einstellungen (4 Tabs) | Normal, Laden | Admin (Abrechnung nur Admin) |
| `/billing/plans` | Abonnement | Normal, Upgrade-Dialog | Admin |
| `/create/video` | Videos Erstellen | noch nicht gestaltet | Admin, Editor |

## 5 Responsives Verhalten

- **≥ 1240 px** — Sidebar 236 px, KPI 4 Spalten, Inhalt 1,62 : 1, Tabellen vollbreit.
- **900–1239 px** — Sidebar 62 px (nur Icons), Inhalt einspaltig, KPI 2-spaltig (auto-fit).
- **640–899 px** — wie Tablet, Topbar-Suche entfällt, Tabellen horizontal scrollbar (min-width 600–640 px).
- **< 640 px** — Bottom-Nav (4 Ziele) + Menü-Sheet, Topbar 54 px, Tabellen werden Listenzeilen,
  Trefferflächen ≥ 44 px, Seiten-Padding 16 px.
- Alle Raster `minmax(0,1fr)` / `auto-fit`; kein horizontaler Overflow, Textzellen kürzen per Ellipsis.

## 6 Motion-Spezifikation

Standard-Easing `cubic-bezier(.2,.7,.2,1)`. Bewegung nur Y (max. 10 px) und Deckkraft.

| Animation | Auslöser | Dauer / Easing | Start → Ende | prefers-reduced-motion |
|---|---|---|---|---|
| Seitenwechsel `pageIn` | Screen-/Routewechsel | 260 ms Desktop, 240 ms Mobile · Standard | opacity 0, Y +6 px → 1, 0 | sofortiger Wechsel |
| Aktiver Sidebar-Zustand | Nav-Auswahl | 220 ms · Standard | transparent/--t2 → --ac-tint + Inset-Line/--ac | springt direkt |
| Sidebar klappen | Klapp-Icon, Tablet-Breite | 240 ms · Standard | `grid-template-columns` 236 → 62 px, Labels aus | ohne Übergang |
| Tabs & Filter | Tab-/Filterwechsel | 180–220 ms · Standard | Farbe + inset box-shadow, keine Größenänderung | direkt |
| Dropdown / Select | Klick | 160 ms auf / 120 ms zu · Standard | opacity 0, Y −4 px → 1, 0 (Ursprung oben) | sofort sichtbar |
| Tooltip | Hover/Fokus, 300 ms Delay | 120 ms ein / 80 ms aus · ease-out | opacity 0, Y +3 px → 1, 0 | nur Ein-/Ausblenden |
| Modal `modalIn`/`overlayIn` | Dialoge | 220 ms Dialog, 180 ms Overlay, 160 ms zu · Standard | opacity 0, scale .98, −4 % Y → 1, 1, zentriert | ohne Skalierung |
| Mobile Sheet `sheetIn` | „Mehr" | 240 ms · Standard | Y +14 px, opacity 0 → 0, 1 | sofort |
| Toast `toastIn` | Speichern, Einladen, Download, Generierung | 240 ms ein · 4,2 s Standzeit · 180 ms aus | opacity 0, Y +10 px → 1, 0 | ohne Gleiten, Standzeit gleich |
| Button-Pressed | `:active` | 80 ms · ease | scale 1 → .97 (primär) / .98 (sekundär) + dunklere Fläche | nur Farbwechsel |
| Tabellen-/Grid-Update `itemIn` | Filter, Sortierung, Pagination | 280 ms · Standard · Stagger 24 ms (max. 8) | opacity 0, Y +8 px → 1, 0; Höhe reserviert | ohne Stagger |
| Generierung läuft `shimmer`/`spin`/`barPulse` | Start der Generierung | Skeleton 1,4 s Loop (Stagger 150 ms), Spinner 800 ms linear, Balken 1,6 s Loop | Platzhalter in Zielgeometrie 4:5 pulsierend | statische Platzhalter + Textfortschritt |
| Ergebnisse einblenden | Generierung fertig | 280 ms · Standard · Stagger 40 ms | Skeleton aus, Bild opacity 0/Y +8 px → 1/0, dann Toast | direkter Austausch |

Verbindlich: `@media (prefers-reduced-motion: reduce)` setzt alle Dauern auf ~0 ms und
Iterationen auf 1 — Endzustände bleiben identisch.

## 7 Implementierungshinweise

1. Tokens als CSS-Variablen auf `:root`; keine Hex-Werte in Komponenten (Ausnahme: Kunden-Markenfarben im Markenprofil).
2. `--ac` ist der einzige Akzent: Primäraktion, aktiver Nav-Zustand, Fortschritt, Token-Anzeige. Statusfarben nur für Status.
3. Text auf Bernstein immer `--ac-ink`.
4. Flächenhierarchie statt Schatten (`--bg < --s1 < --s2 < --s3 < --s4`).
5. Raster mit `minmax(0,1fr)`/`auto-fit`; Tabellen mit `min-width` + horizontalem Scroll.
6. Icons als Inline-SVG im 16er-Raster mit `currentColor` — kein Icon-Font, keine Emoji.
7. Fokus-Ring 2 px `--ac`, Offset 2 px, auf allen interaktiven Elementen; Dialoge mit Fokusfalle und Escape.
8. Mobile Trefferflächen ≥ 44 px.
9. Zustände API-getrieben: Laden = Skeleton in Zielgeometrie · Leer = Grund + nächster Schritt ·
   Fehler = Ursache + Code + Wiederholen · Keine Rechte = Rolle + Zugriff anfragen.
10. Tokenbelastung erst nach erfolgreicher Generierung; bei Fehler/Abbruch keine Belastung und im UI benennen.
11. Rollen (Administrator / Editor / Betrachter) serverseitig durchsetzen.

## 8 Beispieldaten — nicht übernehmen

Beispielbrauerei GmbH, beispielbrauerei.de, gegründet 1878, Oberbayern · Erik Bauer, Marie Keller,
Lisa Hofmann und alle @beispielbrauerei.de-Adressen · Sortiment Helles/Dunkles Landbier, Weißbier,
Kellerbier, Radler, Festbier · Motivnamen und Datumsangaben (28.08.2026) · Kennzahlen 1.240 / 1.600
Tokens, 148 Motive, 12 Generierungen, 3 Plätze · Rechnungsnummern 2026-08-014 ff. · Preise 99 / 299 /
699 € · Tokenkosten 30 / 45 / 90 · Diagrammverläufe synthetisch · Bildflächen sind Platzhalter (`--s3`).

## 9 Nur Prototyp-Steuerung — nicht in die Produktiv-App übernehmen

- Die komplette obere Leiste „PROTOTYP-STEUERUNG": Desktop/Tablet/Mobile, App/Design-System/Handoff,
  Zustands-Umschalter (Normal, Laden, Leer, Fehler, Keine Rechte), Login-Knopf.
- Die Ansichten **Design-System**, **Motion** und **Handoff** selbst — Dokumentation, keine Produktseiten.
- Der Screen „Noch nicht Teil des Prototyps" (Videos, Hilfe, Fehlerdetails).
- Feste Rahmenbreiten 1560 px / 900 px (Tablet) / 420 px (Mobile) — in der App füllt das Layout das Fenster.
- Manuelles Schalten der Zustände; produktiv ergeben sie sich aus Datenlage, Rolle und API-Antwort.

## 10 Paketinhalt

```
BrewAI Studio Final.dc.html   finaler Prototyp (verbindlich)
support.js                    Laufzeit des Prototyps
HANDOFF.md                    dieses Dokument
screenshots/                  finale Ansichten (Desktop + Mobile)
```
