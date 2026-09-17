# Audit: Bilder erstellen — Dialog, Synchronisation und UX

Stand: 16.09.2026. Analyse des aktuellen Arbeitsstands einschließlich uncommitteter Änderungen. Kein Redesign und keine Fehlerbehebung im Rahmen dieses Audits.

## Prüfumfang und Grenzen

Geprüft: aktive Page und Legacy-Reexport, kompletter `InhalteErstellenStudio`-Dialog, Produkt-/Kampagnen-/Story-Modus, Sorten- und Charakterauswahl, Referenzen, Presets, KI-Texthilfen, Markenprofil-Speicherrückruf, Generierungsrouten, Jobstatus, Tokenanzeige, Mediathek-Persistenz, Workspace-Ereignisse, Bildvorschau und mobile CSS-Regeln.

Die lokale Browsernavigation zu `/inhalte-erstellen` wurde nach `/anmelden` umgeleitet. Deshalb sind die folgenden Fehler durch den Code belegte Abläufe, keine vollständig durchgeklickten Reproduktionen mit angemeldetem Konto. Layout und Accessibility sind anhand von JSX/CSS bewertet; Screenshots, Touch-Bedienung und reale Laufzeiten sind noch zu prüfen. Keine kostenpflichtige Generierung ausgelöst. Die 286 Tests des vorangegangenen Scraper-Fixes waren grün; sie belegen diese Dialogabläufe nicht.

## Wichtigste Fehler

### F01 — P1: Paralleles Speichern kann Biersorten löschen

Das Anlegen einer Sorte sendet `[..., beers, newBeer]` aus dem lokalen, möglicherweise alten Zustand als vollständigen Ersatz. `replaceDashboardBeers` löscht anschließend alle IDs, die in dieser Liste fehlen. Beispiel: Tab A kennt A/B; Tab B ergänzt C; Tab A ergänzt D und sendet A/B/D. C wird gelöscht. Auch die Kombination aus Upsert, Lesen und Löschen ist keine gemeinsame Transaktion.

Belege: `src/components/ui/inhalte-erstellen-studio.tsx:411`, `src/lib/dashboard/beer-store.ts:13`.

Abhilfe: Einzelne Sorten per POST/PATCH/DELETE verändern; vollständige Ersetzungen nur transaktional mit Versionsprüfung. Ein Konflikt muss einen 409 liefern, keine stillschweigende Löschung.

### F02 — P1: Wiederaufnahme ist nicht über Navigation oder erneutes Klicken stabil

Jeder Aufruf von `generate` beziehungsweise `generateSocialPost` erstellt einen neuen Idempotenzschlüssel. Nur automatische Retries innerhalb desselben Produktfoto-Aufrufs behalten ihn. Entwurf, Schlüssel und aktive Job-ID werden nicht dauerhaft gehalten. Nach Reload, Navigation oder manuellem Wiederholen nach Verbindungsabbruch kann ein neuer kostenpflichtiger Auftrag neben dem alten entstehen. Social-Posts haben nicht einmal denselben automatischen Netzwerk-Retry wie Produktfotos.

Belege: Studio `:776`, `:977`, `:1004`; Jobstatus-API `src/app/api/dashboard/jobs/route.ts`.

Abhilfe: Auftrag früh mit ID bestätigen, aktive Jobs serverseitig auflisten, Entwurf und Request-Key persistieren. „Status prüfen“ muss denselben Auftrag wiederaufnehmen; „Neue Variante erzeugen“ erstellt bewusst einen neuen.

### F03 — P1: Charaktervarianten überschreiten das gemeinsame Zeitbudget

Die Route läuft höchstens 300 Sekunden. Bis zu drei Varianten werden nacheinander erzeugt; jede KIE-Polling-Schleife hat allein ein Budget von 240 Sekunden. Die Provider-Task-ID bleibt in der Hilfsfunktion und wird hier nicht am Billing-Job verknüpft. Ein Plattformabbruch kann den Abschluss verhindern; der einfache Jobstatus-Endpunkt führt selbst keine Provider-Reconciliation durch.

Belege: `src/app/api/inhalte-erstellen/create-task/route.ts:41`, `:342`; `src/lib/kie/nanoBananaCharacterGenerate.ts:74`, `:198`.

Abhilfe: Dauerhafter Hintergrundauftrag je Variante, sofort gespeicherte Provider-ID, getrennte Statusabfrage und idempotenter Abschluss. Die Lebensdauer einer HTTP-Anfrage darf nicht die Lebensdauer des Bildauftrags bestimmen.

### F04 — P2: Angezeigtes und erzeugtes Bildformat unterscheiden sich

Mit ausgewähltem Charakter wird 1:1, 4:3 oder 16:9 intern zu 4:5 geändert. Formatbuttons, Zusammenfassung und Vorschau zeigen weiter `aspectRatio`. Zusätzlich benutzt ein bereits erzeugtes Bild immer das aktuelle Formularformat: Ein Formatwechsel verändert seine Vorschau und Pixelbeschriftung, obwohl die Bilddatei unverändert bleibt. Im Social-Fallback wird ebenfalls das ursprüngliche statt des effektiven Formats gespeichert.

Belege: Studio `:523`, `:752`, `:927`, `:1748`, `:1774`; Social-Mediathek-Fallback um `:832`.

Abhilfe: Ein sichtbares effektives Format; unzulässige Optionen begründen oder deaktivieren. Ergebnisdaten mit tatsächlich erzeugten Pixelmaßen und unveränderlichem Auftragssnapshot speichern. Vorschau aus Ergebnisdaten rendern.

### F05 — P2: Zusatzreferenzen verschwinden im Charaktermodus

Die Oberfläche erlaubt Produkt, Charakter und bis zu drei zusätzliche Referenzen gleichzeitig. Beide Serverrouten verwenden beim Charakterpfad aber ausschließlich Charakterreferenzen und Produktfoto. `extraRefs` werden zwar geladen, danach nicht an das Modell übergeben.

Belege: `src/app/api/inhalte-erstellen/create-task/route.ts:236`; Social-Route `:244`; Upload-Oberfläche ab Studio `:1610`.

Abhilfe: Referenzrollen ausdrücklich modellieren und Modellgrenzen vor dem Start prüfen. Nicht unterstützte Kombinationen erklären; keinesfalls eine im Dialog sichtbare Referenz still verwerfen.

### F06 — P2: Neuer Markenprofil-Scan aktualisiert das lokale Markenfoto nicht

`onSaved` setzt Profilstatus und Brauereiname und lädt Biersorten nach. `etikettUrl` wird nicht aktualisiert. Das spätere `router.refresh()` erneuert Serverprops, aber die Settings-Abfrage läuft nur bei Mount oder Änderung von `bootstrapNonce`. Der Props-Effekt synchronisiert ebenfalls kein Markenfoto. Ohne Sortenauswahl kann deshalb das alte oder fehlende Hauptmarkenbild aktiv bleiben.

Belege: Studio `:200`, `:326`, `:1999`.

Abhilfe: Nach Aktivierung denselben Workspace-Cache für Profil, Referenzen und Sortiment invalidieren und die bestätigte Serverantwort übernehmen.

### F07 — P2: Sorte und abgeleitete Eingaben können auseinanderlaufen

`refreshBeerImages` ersetzt `selectedBeer`, synchronisiert aber nicht `was`, Glas, Flaschentyp oder Farbe über `applyBeer`. Eine extern bearbeitete Sorte erhält dadurch ein neues Objekt/Bild, während der nächste Request alte Eigenschaften sendet. `applyBeer(null)` lässt diese Werte ebenfalls stehen. Bootstrap-Retry wählt dagegen ungefragt wieder die erste Sorte.

Belege: Studio `:159`, `:258`, `:349`.

Abhilfe: Nur `selectedBeerId` halten und Sorteneigenschaften daraus ableiten. Bewusste Überschreibungen getrennt speichern. Hauptmarke hat eigene Defaults; Neuladen erhält die gewählte ID, solange sie existiert.

### F08 — P2: Charaktere und Guthaben werden nicht zuverlässig nachgeladen

Charaktere werden beim Bootstrap geladen, beim Öffnen des Pickers aber nicht erneut geprüft. Fehler dieses Requests zählen nicht zum Bootstrap-Fehler. Änderungen in einem anderen Tab bleiben unsichtbar. Die Tokenanzeige im Studio lädt beim Bootstrap und bei erfolgreicher eigener Generierung, hört aber nicht auf die Billing-Ereignisse, die der Workspace-Shell verarbeitet. Ein veralteter niedriger Stand kann im Studio eine Generierung lokal blockieren, obwohl das Konto inzwischen Guthaben hat.

Belege: Studio `:286–365`, `:1511`, `:769`; `src/components/studio/studio-workspace-shell.tsx:222`.

Abhilfe: Gemeinsame Datenquelle für Profil, Sortiment, Charaktere, Guthaben und Jobs; gezielte Invalidierung, Revalidierung bei Fokus und optional tabübergreifende Ereignisse. Fehlerzustand von „keine Charaktere vorhanden“ unterscheiden.

### F09 — P2: Charakter + „Frei“ ist auswählbar, scheitert aber serverseitig

„Frei“ setzt `etikettModus=generisch`. Der Server löst das Produktfoto nur im Markenmodus auf, verlangt für Charakteridentität anschließend aber zwingend ein Produktfoto. Die Client-Freigabe prüft diese Kombination nicht. Auch nicht ladbare Charakterreferenzen sind serverseitig problematisch: Die vorgezogene Providerwahl kann den OpenAI-Key leer lassen, während die spätere Entscheidung ohne aufgelöste Charakterfotos zu OpenAI zurückfällt.

Belege: Studio `:507`, `:1126`; Create-Route `:72–87`, `:112`, `:143`, `:210`.

Abhilfe: Gemeinsame Capability- und Validierungsregeln vor Tokenreservierung. Bei unbrauchbaren Identitätsreferenzen explizit abbrechen; kein stiller Providerwechsel.

### F10 — P2: Späte KI-Antworten überschreiben neue Texte

Während „Mit BrewAI verbessern“ oder „Copy vorschlagen“ läuft, können Eingaben und Produkt geändert werden. Die Antwort schreibt später ohne Versionsabgleich in `userPrompt` beziehungsweise Headline/Subline/CTA. Neuere manuelle Änderungen gehen verloren oder ein Vorschlag gehört zur vorher ausgewählten Sorte.

Belege: Studio `:569–618`.

Abhilfe: Request mit Entwurfsrevision verknüpfen. Bei geändertem Entwurf den Vorschlag zur Übernahme anbieten oder verwerfen; „Übernehmen“, „Vergleichen“, „Rückgängig“ bereitstellen.

### F11 — P2: Fertiges Bild ohne Ladefehlerzustand

Die Ergebnisvorschau behandelt `onLoad`, aber kein `onError`. Wenn die Bild-URL abgelaufen oder nicht erreichbar ist, kann die Aurora-Ladeansicht stehen bleiben, während die äußere Leiste bereits „Vorschau bereit“ meldet.

Belege: `src/components/ui/ai-chat-image-generation-1.tsx:70`, `:126`; Studio `:1732`.

Abhilfe: Bildladezustand unabhängig vom Jobzustand führen; Retry mit frisch signierter URL und verständliche Fehlermeldung.

## Weitere Dialog- und UX-Schwächen

- Fortschritt: Produktfoto-Prozente werden lokal auf etwa 96 % hochgezählt; Social-Prozent bleibt weitgehend auf dem Startwert. Das ist kein Providerfortschritt. Besser belegbare Phasen und echte fertige Varianten zeigen.
- Gleichzeitige Bearbeitung: Die meisten Eingaben bleiben während eines Auftrags aktiv. Das ist nur sinnvoll, wenn „aktueller Auftrag“ und „nächster Entwurf“ sichtbar getrennt sind. Momentan verändert der Entwurf die Darstellung alter Ergebnisse.
- Preset entfernen: `clearPreset` setzt zahlreiche Auswahlwerte zurück, lässt aber den eingesetzten Motivtext bestehen. „Entfernen“ hat damit keine eindeutige Semantik. Änderungen eines Presets sollten sichtbar und rückgängig sein.
- Kampagne/Story: Beide verwenden dieselbe Generierung und Textpipeline. Der Feed-Hinweis verspricht 4:5, aber der Wechsel setzt es nur, wenn zuvor 9:16 gewählt war. Besser einen gemeinsamen Modus „Social-Post“ mit explizitem Ausgabeziel anbieten.
- Mobile: „Vorschau prüfen“ führt vor der Generierung zu einem Platzhalter. Der Generate-Button liegt im dritten Bereich. Eine dauerhaft sichtbare Fußleiste mit Preis und „Erstellen“ verkürzt diesen Umweg.
- Varianten: Punkte statt Bildminiaturen erschweren den Vergleich. Eine Galerie mit gleichzeitiger Ansicht, Auswahl und klaren Aktionen wäre deutlich produktiver.
- Ergebnisaktionen: Der Dialog bietet im Wesentlichen Öffnen der Bild-URL. Direkter Download, „Als Referenz“, „Ähnliche Variante“, „Bearbeiten“ und nachvollziehbare Einstellungen fehlen hier.
- Accessibility: Selbst gebaute Preset-/Sortenmodals haben zwar `role=dialog`, aber keinen erkennbaren Fokusfang, Escape-Handler oder Fokus-Rücksprung. Listbox-/Radiogroup-/Tab-Rollen benötigen auch passende Tastatursteuerung. Platzhalter ersetzen bei Copy-Eingaben keine dauerhaften Labels.
- Sprache: „serverseitig“, Modellnamen, „Dev-Server kompiliert“ und Implementierungserklärungen gehören nicht in den normalen Nutzerablauf. Ein Nutzer braucht eine Wirkung und eine konkrete nächste Aktion.
- Bildmetadaten: Clientseitige Mediathek-Fallbacks schreiben fest `2K`; besser tatsächliche Servermetadaten übernehmen. Ein erfolgreicher Provideraufruf ist zudem noch keine erfolgreiche Mediathek-Speicherung.

## Zielbild für ein hochwertiges BrewAI-Studio

Der relevante Vergleich ist Higgsfields Kombination aus wiederverwendbaren Identitäten, visuellen Stilvorgaben, Assets und anschließender Bearbeitung. BrewAI sollte diese Prinzipien auf Brauereien zuschneiden.

### Ein Arbeitsbereich mit drei klaren Aufgaben

1. **Links: Zutaten des Motivs.** Produktkarte mit Foto und Zustand, optionale Charakterkarte, Stil/Ort als visuelle Referenzkarten. Jede Referenz erhält eine Rolle: Produkt, Person, Umgebung oder Look. Eindeutig zeigen, was fix bleibt und was verändert werden darf.
2. **Mitte: Ergebnisfläche und Verlauf.** Große Bildansicht, daneben oder darunter alle Varianten als Miniaturen. Laufende Aufträge behalten ihren Platz; bisherige Ergebnisse verschwinden beim nächsten Start nicht. Vorher/Nachher und vollständige Auftragseinstellungen bleiben erreichbar.
3. **Unten: kompakter Auftrag.** Motivbeschreibung, Format, Varianten und bestätigte Kosten. „Erstellen“ bleibt sichtbar. Erweiterte Optionen stehen in einem aufklappbaren Inspector statt in einer permanenten dritten Pflichtspalte.

Mobile: gleiche Daten und Aktionen, Referenzen als horizontale Karten, Einstellungen als Bottom Sheet, fixe Erstellen-Leiste. Keine leere Vorschau als Pflichtschritt.

### Die wichtigsten Qualitätsfunktionen

- **Produktbindung:** „Etikett erhalten“ und „Markenlook anwenden“ getrennt regeln. Heute koppelt „Stiltreue: Frei“ beide Aspekte und schaltet die Produktreferenz ab.
- **Visuelle Presets:** echte Beispielmotive für „Biergarten“, „Premium-Packshot“, „Zapfhahn“, „Saisonstart“. Beim Anwenden zeigen, welche Einstellungen geändert werden. Presets mit Produkt-/Charaktermodus auf Kompatibilität prüfen.
- **Wiederverwendbarer Markenlook:** Palette, Licht, Materialien und fotografischer Stil als sichtbare gespeicherte Vorgabe. Das aktuelle Markenprofil ist dafür eine gute Basis.
- **Bearbeiten statt neu generieren:** Hintergrund ändern, Ausschnitt ändern und einzelne Elemente bearbeiten. Dafür zusätzliche Modell-/Maskenunterstützung gesondert evaluieren, nicht als schon vorhandene Funktion darstellen.
- **Editierbare Social-Texte:** Hintergrundmotiv und Textlayer getrennt speichern. Headline oder CTA ändern darf nicht automatisch einen neuen Bildauftrag auslösen. Markenfont und Kontrastvorschau ergänzen.
- **Kampagnenvarianten:** dasselbe Produkt und derselbe Look für Feed, Story und Querformat; unterschiedliche Ausschnitte als bewusste Ausgaben, keine versteckte Formatkorrektur.

## Technische Grundlage und Reihenfolge

**Phase 1 — Verlässlichkeit:** F01 bis F09 priorisieren. Zuerst Schutz vor Datenverlust und doppelten Aufträgen, dann Format- und Referenzwahrheit. Keine UI-Politur vor diesen Vertrauensproblemen.

**Phase 2 — Gemeinsamer Zustand:** `CreationDraft` mit Produkt-/Charakter-IDs, Referenzrollen, Text, Ausgabeziel und Revision. Beim Start einen unveränderlichen `GenerationSnapshot` erzeugen. Server liefert auf dieser Basis Validierung, effektive Einstellungen, Kosten und eine Job-ID. Ergebnis und Mediathek referenzieren denselben Snapshot.

**Phase 3 — Dauerhafte Jobs:** Zustand `queued → generating → persisting → completed / partial / failed`, mit tatsächlichen Variantenstatus, stabiler Idempotenz und Wiederaufnahme. Signierte URLs werden bei Bedarf erneuert. Abrechnung und Ergebniswiederholung müssen denselben bestätigten Stand liefern; die konkrete SQL-RPC-Implementierung dafür wurde in diesem Audit nicht verifiziert.

**Phase 4 — Studio-UX:** Galerie und Auftragsverlauf, feste Erstellen-Leiste, Rollen für Referenzen, visuelle Presets, Textlayer-Editor. Anschließend gezielte Bildbearbeitung und Kampagnenserien.

## Abnahmeszenarien

1. Zwei Tabs legen zeitversetzt verschiedene Sorten an; keine Sorte geht verloren.
2. Eine ausgewählte Sorte wird extern bearbeitet; Bild, Flasche, Glas und Request stimmen anschließend überein.
3. Markenprofil neu scannen; Hauptmarkenfoto und Serverauftrag verwenden dieselbe neue Referenz.
4. Charakter + Querformat: angezeigtes, versendetes und gespeichertes Format stimmen überein.
5. Charakter + Zusatzreferenz: entweder nachweislich im Auftrag enthalten oder vor Start verständlich als unzulässig markiert.
6. Reload/Netzabbruch bei laufender Generierung: derselbe Job wird wiedergefunden, keine zweite Reservierung.
7. Eine von drei Varianten schlägt fehl: fertige Varianten bleiben verfügbar; Kosten und Mediathek entsprechen dem bestätigten Ergebnis.
8. Während einer KI-Texthilfe manuell weiterschreiben; die spätere Antwort überschreibt nichts.
9. Abgelaufene Bild-URL: sichtbarer Fehler, erneutes Laden funktioniert ohne Neugenerierung.
10. Tastatur und Smartphone: Dialog schließen, Fokus wiederherstellen, Varianten erreichen und Generierung ohne unnötige Zwischenschritte starten.

## Vergleichsquellen

- [Higgsfield: Soul, Moodboards, Farbpaletten und Identität](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-soul-to-generate-images)
- [Higgsfield Canvas: Assets, Verkettung und wiederverwendbare Workflows](https://higgsfield.ai/canvas-intro)
- [Higgsfield Canvas: Referenzrollen und Arbeitsablauf](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-canvas)

Diese Quellen beschreiben Higgsfields Funktionen. Das oben vorgeschlagene BrewAI-Layout ist eine eigene Empfehlung, keine Behauptung über eine visuell geprüfte Higgsfield-Oberfläche.
