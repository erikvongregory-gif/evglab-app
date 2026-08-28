# Erster Auftrag an Cursor: Audit vor dem Redesign

Du arbeitest im bestehenden BrewAI-Studio-Repository. Im Projekt liegt zusätzlich der Ordner `BrewAI-Cursor-Handoff` mit der finalen visuellen und interaktiven Redesign-Spezifikation.

## Ziel

Das bestehende Produkt soll ausschließlich visuell und in seinen UI-Interaktionen neu gestaltet werden. Die bereits funktionierende Geschäftslogik muss vollständig erhalten bleiben. Das gilt insbesondere für Prompt-Erstellung, Markenprofil, Bildgenerierung, Supabase, Authentifizierung, Rollen, Tokens, Abonnements, APIs und gespeicherte Daten.

## Verbindliche Redesign-Quellen

Lies vollständig:

1. `BrewAI-Cursor-Handoff/HANDOFF.md`
2. `BrewAI-Cursor-Handoff/BrewAI Studio Final.dc.html`
3. `BrewAI-Cursor-Handoff/README.md`
4. die relevanten Bilder unter `BrewAI-Cursor-Handoff/references/`

Der HTML-Prototyp ist ausschließlich eine visuelle und interaktive Referenz. Er ist keine neue Anwendung. Übernimm weder seine Beispieldaten noch seine Claude-spezifische Laufzeit oder Komponentenstruktur in die Produktiv-App.

## Phase 1 – ausschließlich analysieren

Nimm noch keine Änderungen am Code vor. Erstelle keine Dateien, installiere keine Pakete, führe keine Migrationen aus und ändere keine Konfiguration.

Analysiere das vollständige bestehende Repository und dokumentiere:

1. Tech-Stack, Verzeichnisstruktur, Routen und zentrale Einstiegspunkte.
2. Alle bestehenden Seiten und tatsächlich vorhandenen Funktionen.
3. Reine UI-Komponenten und Styling-Dateien.
4. Komponenten, in denen Darstellung und Geschäftslogik vermischt sind.
5. Prompt-Templates, Prompt-Builder, Systemprompts und Bildgenerierungslogik.
6. Aufbau, Felder, Validierung, Speicherung und Nutzung des Markenprofils.
7. Supabase-Clients, Abfragen, Tabellenzugriffe, Storage und Realtime-Nutzung.
8. API-Routen, Server Actions, Webhooks, Edge Functions und externe Anbieter.
9. Authentifizierung, Rollen, Berechtigungen und geschützte Routen.
10. Token-, Abonnement-, Zahlungs- und Abrechnungslogik.
11. Fehler-, Lade-, Leer- und Erfolgszustände, die bereits funktional existieren.
12. Bestehende Tests, Build-Kommandos, Linting und Typprüfung.

## Schutzliste

Erstelle anschließend eine konkrete Schutzliste mit Dateipfaden und Begründung. Markiere mindestens:

- `NICHT ÄNDERN` – fachliche Logik oder sicherheitskritischer Bereich
- `NUR SCHNITTSTELLE BEIBEHALTEN` – UI darf ersetzt werden, Props, Rückgabewerte und Verhalten müssen identisch bleiben
- `UI-FREI ÄNDERBAR` – reine Darstellung ohne Geschäftslogik
- `VOR ÄNDERUNG RÜCKFRAGE` – unklare oder gekoppelte Bereiche

Besonders geschützt sind:

- Prompt- und Generierungslogik
- Markenprofil-Datenmodell und dessen Verarbeitung
- Supabase-Schema, Migrationen, RLS-Policies und Storage-Regeln
- API-Routen, Server Actions und externe Integrationen
- Authentifizierung und Berechtigungen
- Tokenbuchung und Abrechnung
- Environment-Variablen und Secrets
- bestehende Analytics-, Logging- und Fehlerbehandlung

## Mapping und Umsetzungsplan

Erstelle danach:

1. Eine Zuordnung von bestehenden Seiten und Komponenten zu den neuen Komponenten aus `HANDOFF.md`.
2. Eine Liste fachlicher Unterschiede zwischen echtem Produkt und Beispieldaten des Prototyps.
3. Einen schrittweisen Plan in kleinen, einzeln testbaren Tickets.
4. Für jedes Ticket: betroffene Dateien, erlaubte Änderungen, geschützte Schnittstellen, Abnahmekriterien und passende Tests.
5. Eine Empfehlung, ob einfache Übergänge mit CSS umgesetzt werden können und ob für komplexe Mount/Unmount- oder Layout-Animationen bereits eine geeignete Bibliothek vorhanden ist. Keine neue Abhängigkeit ohne spätere ausdrückliche Freigabe.

Die empfohlene Reihenfolge soll grundsätzlich sein:

1. eigener Redesign-Branch
2. Design-Tokens und Fonts
3. wiederverwendbare UI-Grundkomponenten
4. App-Shell, Sidebar, Topbar und Mobile-Navigation
5. Dashboard
6. Bilder erstellen
7. Markenprofil
8. Mediathek
9. Team, Einstellungen und Abonnement
10. Motion-System und reduzierte Bewegung
11. vollständige Regressionstests

Passe die Reihenfolge an die tatsächliche Architektur an und begründe jede Abweichung.

## Verbindliche Regeln für die spätere Umsetzung

- Kein Big-Bang-Umbau.
- Immer nur ein freigegebenes Ticket umsetzen.
- Keine Änderung von Datenbank, APIs, Prompts oder Geschäftslogik für rein visuelle Ziele.
- Bestehende Event-Handler, Datenflüsse, Validierungen und Berechtigungsprüfungen erhalten.
- Keine Beispieldaten aus dem Prototyp übernehmen.
- Keine neue Abhängigkeit ohne Begründung und Freigabe.
- Keine Prototyp-Steuerung in die Produktiv-App übernehmen.
- Responsive Verhalten, Tastaturbedienung, Fokuszustände und `prefers-reduced-motion` berücksichtigen.
- Nach jedem Ticket Build, Typprüfung, Linting und relevante Tests ausführen.
- Bei notwendiger Änderung eines geschützten Bereichs stoppen und vorab erklären, warum sie unvermeidbar wäre.

## Gewünschte Antwort

Liefere ausschließlich:

1. Repository-Bestandsaufnahme
2. Schutzliste mit konkreten Dateipfaden
3. Mapping Altbestand → Redesign
4. Risiken und offene Fragen
5. priorisierten Ticketplan
6. Test- und Abnahmeplan

Ändere noch nichts und warte nach der Analyse auf meine Freigabe.
