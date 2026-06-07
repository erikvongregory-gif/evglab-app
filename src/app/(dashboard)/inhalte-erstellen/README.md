# Inhalte erstellen

Modulare Bild-Engine fuer Brauerei-Kunden. Jeder Modus besitzt ein eigenes Zod-Schema, einen eigenen Prompt-Builder und eine eigene API-Route.

## Modi

- Hyperrealistisch: `POST /api/generate-hyperrealistic`, `gpt-image-2-2026-04-21`, Etikett als Referenzbild, `n: 2`.
- Produkt freistellen: `POST /api/generate-isolate`, Photoroom Segment API, Fallback `remove.bg`, kein GPT-Rendering.
- Produkt Studio: `POST /api/generate-studio`, `gpt-image-2-2026-04-21`, Auto-Glas und Auto-Garnitur nach Bierstil.
- Kampagnenbild mit Text: `POST /api/generate-campaign`, `gpt-image-2-2026-04-21`, 3-5 Feed-Referenzen, Thinking fuer Layout/Text aktiv.

## Single Source Of Truth

`lib/brewing-knowledge.ts` enthaelt Flaschen, Glasformen und Bierstil-Garnituren. Prompt-Builder duerfen diese Daten nicht duplizieren.

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

Lokale Next.js-Dokumente unter `node_modules/next/dist/docs/` waren in diesem Checkout nicht vorhanden; fuer Route Handler wurde die aktuelle Next.js Route-Handler-Dokumentation geprueft.
