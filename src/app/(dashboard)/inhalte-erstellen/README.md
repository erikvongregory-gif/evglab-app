# Inhalte erstellen

Modulare Bild-Engine fuer Brauerei-Kunden. Jeder Modus besitzt ein eigenes Zod-Schema, einen eigenen Prompt-Builder und eine eigene API-Route.

## Modi

- Aktuelles Studio: `POST /api/inhalte-erstellen/create-task` bzw. `social-post`, `gpt-image-2.5-sunburst`, Produkt-, Form-, Glas-, Szenen- und Look-Referenzen mit festen Rollen.
- Fotostil im aktuellen Studio: `photoStyle: reportage | premium | campaign`; die Auswahl steuert Kamera, Licht und Komposition. `hyperreal` bleibt ein unabhängig kombinierbarer Realismus-Lock.
- Hyperrealistisch (Legacy): `POST /api/generate-hyperrealistic`, `gpt-image-2.5-sunburst`, Etikett als Referenzbild, `n: 2`.
- Produkt freistellen: `POST /api/generate-isolate`, Photoroom Segment API, Fallback `remove.bg`, kein GPT-Rendering.
- Produkt Studio: `POST /api/generate-studio`, `gpt-image-2.5-sunburst`, Auto-Glas und Auto-Garnitur nach Bierstil.
- Kampagnenbild mit Text: `POST /api/generate-campaign`, `gpt-image-2.5-sunburst`, 3-5 Feed-Referenzen, Thinking fuer Layout/Text aktiv.

## Single Source Of Truth

`lib/brewing-knowledge.ts` enthaelt Flaschen, Glasformen und Bierstil-Garnituren. Prompt-Builder duerfen diese Daten nicht duplizieren.

Interne neutrale Formreferenzen liegen in Supabase unter `bottle-references/` und `glass-references/`; lokale Fallback-Dateien und Aufnahmeregeln sind in `assets/REFERENCE_IMAGES.md` dokumentiert.

Neue Flasche:

1. Eintrag in `FLASCHEN_TYPEN` ergaenzen.
2. `flaschenTypSchema` in `lib/schemas.ts` um den Key erweitern.
3. UI-Selector nutzt die DB automatisch.

Neuer Bierstil:

1. Eintrag in `STUDIO_PROPS_BY_BIERSTIL` ergaenzen.
2. `bierstilSchema` in `lib/schemas.ts` um den Key erweitern.
3. `DEFAULT_GLAS_BY_STIL` in `prompt-builders/product-studio.ts` erweitern.
4. Test `studio glass auto mapping` muss gruen bleiben.

## UI-Hinweise

Die Seite zeigt pro Modus eine Prompt-Vorschau unter "Advanced anzeigen", einen Quality-Toggle fuer Vorschau/Final, Credit-Preview, Loading-Hinweis und lokale History mit den letzten 20 Generierungen pro Modus (`localStorage`). Uploads werden lokal als Data-URLs vorgehalten; produktionsseitig kann davor ein Upload-/Crop-Service geschaltet werden.

## Migration Notes

Bestehende Routen wie `/api/openai/image2/generate` und `/api/kie/nano-banana/create-task` bleiben als Legacy-Pfade erhalten. Die neuen Routen sind bewusst separat, damit bestehende Dashboard-Flows nicht gebrochen werden. Nach erfolgreicher UI-Migration koennen Legacy-Routen als deprecated markiert und spaeter entfernt werden.

Die lokale Next.js-Dokumentation unter `node_modules/next/dist/docs/` ist fuer Aenderungen an Route Handlern verbindlich.
