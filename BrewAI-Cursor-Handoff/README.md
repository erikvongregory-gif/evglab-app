# BrewAI Studio – Cursor-Handoff

Dieses Paket ist die visuelle und interaktive Spezifikation für das Redesign der bestehenden BrewAI-Studio-Anwendung.

## Verbindliche Quellen

1. `HANDOFF.md` – Design-Tokens, Komponenten, Routen, Responsive-Verhalten und Motion-System
2. `BrewAI Studio Final.dc.html` – klickbarer Claude-Design-Prototyp
3. `references/` – visuelle Referenzen für Desktop und Mobile
4. `CURSOR_PROMPT.md` – erster Auftrag an Cursor

`support.js` wird ausschließlich zum Anzeigen des Claude-Prototyps benötigt. Der Prototyp ist keine neue Produktiv-App und darf nicht anstelle des bestehenden Projekts eingebaut werden.

## Priorität bei Widersprüchen

`HANDOFF.md` und `BrewAI Studio Final.dc.html` sind verbindlich. Die Bilder in `references/` dienen der visuellen Kontrolle. Bestehende echte Daten, Funktionen, Prompts, API-Anbindungen und Backend-Prozesse haben fachlich Vorrang vor den Beispieldaten des Prototyps.

## Nicht übernehmen

- Prototyp-Steuerungsleiste
- Design-System- und Handoff-Ansichten als Produktseiten
- Beispielnamen, Beispielpreise, Beispielkennzahlen und synthetische Daten
- Claude-spezifische `x-dc`- und `sc-if`-Struktur
- alte Designvarianten oder Inspirationen

## Vorgehen

Den Inhalt von `CURSOR_PROMPT.md` zuerst unverändert an Cursor senden. Cursor darf in dieser ersten Phase ausschließlich analysieren und noch keine Dateien verändern.
