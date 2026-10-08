# Inhalte erstellen

Modulare Bild-Engine fuer Brauerei-Kunden. Alle Bild-Szenen verwenden die V3-Prompt-Engine in `src/lib/inhalte-erstellen/image-prompt-v3.ts`.

## Modi

- Aktuelles Studio: `POST /api/inhalte-erstellen/create-task` bzw. `social-post`, `gpt-image-2.5-sunburst`, Produkt-, Form-, Glas-, Szenen- und Look-Referenzen mit festen Rollen.
- Presets: `photoStyle: reportage | premium | campaign`; alle drei verwenden V3. Die Presets steuern fotografische Technik; Szene, Personen und Kleidung kommen aus dem Kundenbrief. Produktfoto und Social-Post sind Ausgabewege, keine weiteren Presets. Es gibt keinen zusätzlichen Hyperreal-Lock.
- Hyperrealistisch (Legacy): `POST /api/generate-hyperrealistic`, `gpt-image-2.5-sunburst`, Etikett als Referenzbild, `n: 2`.
- Produkt freistellen: `POST /api/generate-isolate`, Photoroom Segment API, Fallback `remove.bg`, kein GPT-Rendering.
- Produkt Studio: `POST /api/generate-studio`, V3-Kompatibilitätsadapter, stilgerechtes Glas und ausschließlich ausdrücklich gewählte Requisiten.
- Kampagnenbild mit Text: `POST /api/generate-campaign`, `gpt-image-2.5-sunburst`, 3-5 Feed-Referenzen, Thinking fuer Layout/Text aktiv.

## Single Source Of Truth

`lib/brewing-knowledge.ts` enthaelt Flaschen, Glasformen und Bierstil-Garnituren. Prompt-Builder duerfen diese Daten nicht duplizieren.

Interne neutrale Formreferenzen liegen in Supabase unter `bottle-references/` und `glass-references/`; lokale Fallback-Dateien und Aufnahmeregeln sind in `assets/REFERENCE_IMAGES.md` dokumentiert.

Neue Flasche:

1. Eintrag in `FLASCHEN_TYPEN` ergaenzen.
2. `flaschenTypSchema` in `lib/schemas.ts` um den Key erweitern.
3. UI-Selector nutzt die DB automatisch.

Neuer Bierstil (Studio):

1. `BEER_PHYSICS` in `prompt-builders/hyperrealism-blocks.ts`: Farbe (SRM/Hex), Flüssigkeit, Schaum, **Schaumhöhe (`head`)**, Kohlensäure.
2. `BEER_STYLE_OPTIONS` in `lib/beer-styles.ts`: Label + stilgerechtes Glas.
3. `NAME_STYLE_HINTS` in `lib/brand/beer-catalog-intake.ts`: Erkennung aus dem Produktnamen (spezielle Sorten vor allgemeinen).
4. Naturtrüb per Default? Dann `resolveBeerClarity` erweitern.
5. Test `brewer-knowledge.test.ts` prüft, dass jede Sorte Profil, Schaumhöhe und Glas hat.

Neues Glas:

1. `GLAS_TYPEN` (inkl. `eichstrich`) und `GLAS_NOMINAL_ML` in `lib/brewing-knowledge.ts`, `glasTypSchema` in `lib/schemas.ts`, `GLASS_FORBIDDEN` in `hyperrealism-blocks.ts`.
2. Umriss in `scripts/generate-glass-references.mjs` ergänzen und `node scripts/generate-glass-references.mjs` laufen lassen.
3. Keine Schaumangaben in die Glasbeschreibung — die Schaumhöhe kommt aus der Sorte.

Legacy Produkt-Studio (`/api/generate-studio`): `legacy-v3-adapters.ts` erhält vorhandene Hintergrund-, Licht- und Glasoptionen und nutzt V3 ohne erfundene Gebindeform.

## UI-Hinweise

Die Seite zeigt pro Modus eine Prompt-Vorschau unter "Advanced anzeigen", einen Quality-Toggle fuer Vorschau/Final, Credit-Preview, Loading-Hinweis und lokale History mit den letzten 20 Generierungen pro Modus (`localStorage`). Uploads werden lokal als Data-URLs vorgehalten; produktionsseitig kann davor ein Upload-/Crop-Service geschaltet werden.

## Migration Notes

Bestehende Routen wie `/api/openai/image2/generate` und `/api/kie/nano-banana/create-task` bleiben als Legacy-Pfade erhalten. Die neuen Routen sind bewusst separat, damit bestehende Dashboard-Flows nicht gebrochen werden. Nach erfolgreicher UI-Migration koennen Legacy-Routen als deprecated markiert und spaeter entfernt werden.

Auch die Legacy-Bildrouten verwenden V3 bzw. dessen Freitextadapter. Freistellung mit Photoroom/remove.bg und Videoerstellung sind keine fotografischen Szenen-Presets. V1/V2 und ihre Tests sind außerhalb dieses Repositories gesichert unter `E:/Arbeit/BrewAI-Backups/prompt-v1-v2-20261008-1018` und werden nicht mehr importiert. Tests prüfen alle sechs Kombinationen aus drei Presets und zwei Ausgabewegen sowie die Kompatibilitätsadapter.

Die lokale Next.js-Dokumentation unter `node_modules/next/dist/docs/` ist fuer Aenderungen an Route Handlern verbindlich.
