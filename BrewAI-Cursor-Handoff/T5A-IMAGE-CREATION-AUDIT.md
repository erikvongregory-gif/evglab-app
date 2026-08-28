# T5a — Funktionsaudit „Bilder Erstellen“

**Branch:** `redesign/final-handoff`  
**Audit-Basis-HEAD:** `cbf6f46` (T4.1)  
**Datum:** 2026-08-28  
**Scope:** Read-only-Analyse. Keine Produktionslogik geändert.

---

## 0. Preflight

| Prüfung | Ergebnis |
| -------- | -------- |
| Branch | ✅ `redesign/final-handoff` |
| HEAD | ✅ `cbf6f460188eb529f7833fda4b2f317c348313e9` (`cbf6f46`) |
| Working Tree | ⚠️ **Nicht sauber** — zahlreiche unstaged/untracked Änderungen außerhalb T5a (u. a. Prompt-, API-, Billing-Arbeit). Audit basiert auf committed Stand + Quellcode-Lesung. |
| T4.1 ESLint (5 TS/TSX-Dateien) | Siehe Abschnitt 12 |

**Hinweis:** T5b darf erst nach Freigabe beginnen. HTML-Prototyp (`BrewAI Studio Final.dc.html`) und `HANDOFF.md` sind **visuelle Referenz**, keine Businesslogik-Quelle.

---

## 1. Route & Einstieg

| Aspekt | Fakt (belegt im Code) |
| ------ | --------------------- |
| **Produktions-Route** | `/inhalte-erstellen` |
| **Design-Handoff-Route (Mock)** | `/design-handoff?screen=create-start` / `create-locked` |
| **HANDOFF-Prototyp-Route** | `/create/image` (nur Prototyp, nicht Next.js) |
| **Server Page** | `src/app/(dashboard)/inhalte-erstellen/page.tsx` → `InhalteErstellenPage` |
| **Client-Hauptkomponente** | `src/components/ui/inhalte-erstellen-redesign.tsx` → `InhalteErstellenRedesign` |
| **Layout-Kette** | `(dashboard)/layout.tsx` → `StudioWorkspaceShell` → `DashboardStudioShell` + Seiteninhalt |
| **Metadata** | `title: "BrewAI - Bilder Erstellen"`, `dynamic = "force-dynamic"` |

### Server-Gates in `page.tsx` (vor Render)

1. Supabase nicht konfiguriert → statische Fehlerseite  
2. Kein User → `redirect("/anmelden")`  
3. Nicht-Owner ohne aktives Abo → `CreateContentLockedView` (nach `ensureBillingRow`, optional `syncBillingFromStripe`)  
4. Owner → überspringt Abo-Gate  
5. Sonst → `<InhalteErstellenRedesign … brandProfile* />`

Zusätzlich: `(dashboard)/layout.tsx` erzwingt **2FA** (`hasPassedTwoFactor`) für alle Studio-Routen.

---

## 2. End-to-End-Ablauf (Ist-Zustand)

```
[Browser] GET /inhalte-erstellen
    → Server: Auth, Abo-Gate, Brand-Props
    → StudioWorkspaceShell (Nav=create, Topbar-Tokens, Onboarding)
    → InhalteErstellenRedesign
        → ComposerProvider (composer-state)
        → useEffect: GET /api/dashboard/settings + /api/dashboard/summary
        → useEffect: GET /api/dashboard/my-beers
        → flowMode "composer" (Default) | "wizard" (MarketingPromptCreateShell)

[Composer-Pfad — Primary]
    StudioImageComposer (Modus, Prompt, Pills, Generate)
        → onGenerate → generateFromComposer()
            → hyperreal: generate() → POST /api/inhalte-erstellen/create-task
            → studio:    POST /api/generate-studio
            → campaign:  POST /api/generate-campaign
            → isolate:   UI disabled; generateIsolateFromComposer existiert, nicht an Button

[API — Hyperreal / create-task]
    requireImageGenerationUser + requireActiveSubscription
    hyperrealisticSchema.safeParse
    Brand: getBrandProfileFromMetadata, buildBrandProfilePromptContext
    Prompt: buildHyperrealisticPrompt | buildProductPlacementPrompt | Claude generateBrauereiBildPrompt
    Token-Vorprüfung → OpenAI generateOpenAiImage (N Varianten) → Storage Upload
    consumeTokens NUR für erfolgreiche Bilder → allocateNextChargeNumber
    Response: signed URLs, billing, prompt, chargeNumber

[Client nach Erfolg]
    setSessionCards (ComposerResultFeed)
    persistMediaBatch → POST /api/dashboard/media
    dispatchEvent("evglab-billing-updated")
    Kein Auto-Redirect zur Mediathek

[Wizard-Pfad — Secondary]
    startCustomWizard / Onboarding → flowMode "wizard"
    MarketingPromptCreateShell (Micro-Steps: Bierstil, Behälter, Szene, …)
    Review → applyWizardToComposer → zurück zu Composer
    Generierung weiter über generateFromComposer / generate()
```

---

## 3. Beteiligte Dateien (vollständige Liste)

### Routing & Shell

- `src/app/(dashboard)/inhalte-erstellen/page.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/components/studio/studio-workspace-shell.tsx`
- `src/components/ui/dashboard-studio-shell.tsx`
- `src/components/studio/create-content-locked-view.tsx`

### Client UI (Produktion)

- `src/components/ui/inhalte-erstellen-redesign.tsx` (**Orchestrator**, ~2900 Zeilen)
- `src/components/ui/marketing-prompt-create-shell.tsx` (Wizard-Shell)
- `src/components/studio/composer/composer-context.tsx`
- `src/components/studio/composer/composer-state.ts`
- `src/components/studio/composer/studio-image-composer.tsx`
- `src/components/studio/composer/composer-control-pills.tsx`
- `src/components/studio/composer/composer-generate-button.tsx`
- `src/components/studio/composer/composer-subscription-modal.tsx`
- `src/components/studio/composer/composer-token-buy-dialog.tsx`
- `src/components/studio/composer/composer-result-feed.tsx`
- `src/components/studio/composer/composer-job-eta.ts`
- `src/components/studio/composer/composer-styles.ts`
- `src/components/studio/composer/result-feed-types.ts`
- `src/components/dashboard/BrandProfileSetupModal.tsx`
- `src/components/studio/onboarding/*` (Welcome, Checklist, Hints, Context)

### Domain / Engine (geschützt)

- `src/app/(dashboard)/inhalte-erstellen/lib/schemas.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/api-guards.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/brewing-knowledge.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/beer-styles.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/occasion-templates.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealistic.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/hyperrealism-blocks.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/product-studio.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/product-isolate.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/campaign-text.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/prompt-builders/enforce-prompt-constraints.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/image-clients/openai-image.ts`
- `src/app/(dashboard)/inhalte-erstellen/lib/image-clients/background-removal.ts`
- `src/lib/prompts/brauerei-bild/generate-prompt.ts`
- `src/lib/prompts/brauerei-bild/map-hyperrealistic-brief.ts`
- `src/lib/openai/generateImage.ts`
- `src/lib/openai/bottleShapeReference.ts`
- `src/lib/brand/reference-image-bytes.ts`
- `src/lib/brand/resolve-reference-for-generation.ts`
- `src/lib/dashboard/brandProfile.ts`
- `src/lib/dashboard/metadata.ts`
- `src/lib/dashboard/media-store.ts`
- `src/lib/billing/generationTokenCost.ts`
- `src/lib/billing/generationBilling.ts`
- `src/lib/billing/store.ts` (`consumeTokens`, `ensureBillingRow`)
- `src/lib/billing/access.ts`
- `src/lib/supabase/storage.ts`
- `src/lib/security/requestGuards.ts`
- `src/lib/ai/providerRequest.ts`
- `src/lib/featureFlags.ts` (`isVideosCreateEnabled`)

### API-Routen (Produktion)

- `POST /api/inhalte-erstellen/create-task` — **Hyperreal (Composer-Hauptpfad)**
- `POST /api/generate-studio`
- `POST /api/generate-campaign`
- `POST /api/generate-isolate` (implementiert, Composer-UI gesperrt)
- `POST /api/generate-hyperrealistic` — **Legacy**, nur `ModeHyperrealistic.tsx` (orphan)
- `GET/POST /api/dashboard/settings`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/my-beers`
- `POST /api/dashboard/media`
- `POST /api/dashboard/composer-reference` (Referenz-Upload)
- `POST /api/analytics/image-flow` (**Route existiert, Client-Aufruf nicht nachweisbar**)

### Legacy / nicht im Produktions-Pfad

- `src/app/(dashboard)/inhalte-erstellen/components/ModeHyperrealistic.tsx`
- `src/app/(dashboard)/inhalte-erstellen/components/ModeProductStudio.tsx`
- `src/app/(dashboard)/inhalte-erstellen/components/ModeCampaignText.tsx`
- `src/app/(dashboard)/inhalte-erstellen/components/ModeProductIsolate.tsx`  
  → Keine Imports in `page.tsx` oder `inhalte-erstellen-redesign.tsx`

### Styles (aktuell)

- Klassen in `studio-image-composer.tsx`: `evg-pagehead`, `evg-form`, `evg-modes`, `evg-textarea`, …
- `src/styles/studio-screens.css` (untracked im Working Tree — ggf. Composer-Styles)
- Inline-Styles in `inhalte-erstellen-redesign.tsx`

### Design-Referenz (nur Lesen)

- `BrewAI-Cursor-Handoff/BrewAI Studio Final.dc.html`
- `BrewAI-Cursor-Handoff/HANDOFF.md`
- `BrewAI-Cursor-Handoff/references/image-create-desktop.png`
- `src/app/design-handoff/page-client.tsx` (Mock Composer, keine Generierung)

---

## 4. Schutzkarte

| Bereich | Datei/Funktion | Eingaben | Ergebnis/Seiteneffekt | Darf T5 ändern? |
| ------- | -------------- | -------- | --------------------- | --------------- |
| Hyperreal-Zod | `hyperrealisticSchema` (`schemas.ts`) | JSON Body | Validiertes `HyperrealisticInput` | **Nein** |
| Studio-Zod | `productStudioSchema` | JSON Body | Validiertes Studio-Input | **Nein** |
| Campaign-Zod | `campaignTextSchema` | JSON Body | Validiertes Campaign-Input | **Nein** |
| Isolate-Zod | `productIsolateSchema` | JSON Body | Validiertes Isolate-Input | **Nein** |
| Prompt Hyperreal | `buildHyperrealisticPrompt`, `buildProductPlacementPrompt` | `HyperrealisticInput`, Brand | Englischer Prompt-String | **Nein** |
| Prompt Studio | `buildProductStudioPrompt` | Studio-Input | Prompt-String | **Nein** |
| Prompt Campaign | `buildCampaignTextPrompt` (campaign-text.ts) | Campaign-Input | Prompt-String | **Nein** |
| Prompt Constraints | `enforceHyperrealisticPromptConstraints` | Prompt + Input | Gekürzter/angereicherter Prompt | **Nein** |
| Claude Skill | `generateBrauereiBildPrompt` | Anthropic + Brief + Brand | Prompt-Rewrite | **Nein** |
| Brauerei-Brief | `buildHyperrealisticClaudeUserMessage` | Hyperreal-Input | Claude-User-Message | **Nein** |
| Brewing SSOT | `brewing-knowledge.ts`, `beer-styles.ts` | Keys/Enums | Flaschen/Glas/Stil-Daten | **Nein** |
| API Guards | `requireImageGenerationUser`, `requireBillableImageGenerationUser` | Request | Auth, Rate-Limit, Same-Origin | **Nein** |
| Abo-Gate API | `requireActiveSubscription` | userId | 402 wenn kein Abo | **Nein** |
| Abo-Gate Page | `InhalteErstellenPage` | Billing-Row | `CreateContentLockedView` | **Nein** (nur Presentation des Locked-Views in T5 erlaubt, nicht Gate-Logik) |
| Token-Kosten | `calculateGenerationTokenCost`, `calculatePerVariantTokenCost` | Modus, Auflösung, Ref, Varianten | Token-Schätzung | **Nein** |
| Token-Vorprüfung | `requireTokenBudget` / inline in create-task | userId, cost | 402 vor Provider | **Nein** |
| Token-Abbuchung | `consumeTokens` / `chargeGeneratedTokens` | userId, consumed | Billing-Update | **Nein** — **niemals doppelt auslösen** |
| Abbuchungszeitpunkt | create-task L260–265; generate-* nach Upload | Erfolgreiche Bilder | `billing.consumed` in Response | **Nein** — UI darf keine zweite Abbuchung triggern |
| Storage | `uploadGeneratedImageToStorage`, `createSignedObjectUrls` | Buffer, userId | Private URLs + Pfade | **Nein** |
| Charge-Nummer | `allocateNextChargeNumber` | userId | `chargeNumber` in Response | **Nein** |
| Mediathek | `persistMediaBatch` → `POST /api/dashboard/media` | Feed-Metadaten | Persistenz user_metadata | **Nein** (Handler-Aufruf beibehalten) |
| Brand-Kontext | `getBrandProfileFromMetadata`, `buildBrandProfilePromptContext` | user_metadata | Prompt-Kontext | **Nein** |
| Etikett-Auflösung | `resolveReferenceImageForVision` | URL + metadata | Vision-Bytes | **Nein** |
| Composer-State-Reducer | `composerReducer`, `ComposerAction` | dispatch | Modus-spezifische Slices | **Nein** (nur lesen/weiterreichen) |
| Generate-Orchestrierung | `generate`, `generateFromComposer`, `generate*FromComposer` | Composer + Wizard-State | fetch + State-Updates | **Nein** — T5 nur **einen** `onGenerate`-Handler behalten |
| OpenAI-Aufruf | `generateOpenAiImage` | API Key, Prompt, Refs | Image Buffer | **Nein** |
| Provider-Fehler | `providerErrorResponse`, `logProviderFailure` | ProviderError | HTTP + Logs | **Nein** |
| Feature-Flag Videos | `isVideosCreateEnabled()` | ENV | Video-Tab sichtbar | **Nein** |
| Session Reuse | `sessionStorage "evg-reuse-media"` | Mediathek → Create | Composer PATCH | **Nein** (Verhalten beibehalten) |
| Billing-Event | `evglab-billing-updated` CustomEvent | Nach Erfolg | Topbar-Token-Refresh | **Nein** — nicht doppelt feuern |
| Composer-Referenz-Upload | `POST /api/dashboard/composer-reference` | File | Storage-URL | **Nein** |
| Analytics-API | `POST /api/analytics/image-flow` | eventName, preset | console.info | **Nein** (nicht anbinden ohne Produktentscheid) |

### Verbindliche Regeln für T5

1. **Prompt-, API-, Billing-, Zod-, Storage-Logik** nur importieren und aufrufen — nicht neu schreiben oder vereinfachen.  
2. **Kein Attrappen-Generate**: Design-Buttons müssen an bestehende Handler (`onGenerate`, `generateFromComposer`) hängen.  
3. **Ein Klick = ein API-Lauf**: `loading`-Guard in `tryGenerate` / `generate` beibehalten; kein doppeltes `onClick` + `onSubmit`.  
4. **Token-Abbuchung nur serverseitig** nach Erfolg; UI zeigt Schätzung via `calculateGenerationTokenCost`.  
5. **HTML-Prototyp nicht einbetten** — nur React/CSS nachbauen.

---

## 5. Prompt- & API-Ablauf je Modus

| Modus | UI-Einstieg | Client-Handler | API | Prompt-Builder | Provider |
| ----- | ----------- | -------------- | --- | -------------- | -------- |
| **Hyperreal** (Ultra Realistic) | Composer + Wizard-Mapping | `generateFromComposer` → `generate()` | `POST /api/inhalte-erstellen/create-task` | `hyperrealistic.ts`, optional Claude Skill, `enforce-prompt-constraints` | OpenAI `gpt-image-2` |
| **Studio** | Composer Tab | `generateStudioFromComposer` | `POST /api/generate-studio` | `product-studio.ts` | OpenAI via `openai-image.ts` |
| **Campaign** | Composer Tab | `generateCampaignFromComposer` | `POST /api/generate-campaign` | `campaign-text.ts` | OpenAI |
| **Isolate** | Tab disabled | `generateIsolateFromComposer` (unreachable via UI) | `POST /api/generate-isolate` | `product-isolate.ts` | Photoroom / remove.bg |

**Hyperreal Detail:** Client baut `HyperrealisticInput` aus Wizard-State (`was`, `wo`, `wie`, …) + Composer-Overrides (`referenceUrl`, `strictLabel`, `variantCount`). Server validiert erneut mit `hyperrealisticSchema`.

**Partial Success:** create-task kann `partial: true` + `partialErrors` liefern; Client zeigt Warnung, speichert erfolgreiche Varianten, Tokens nur für gelieferte Bilder.

---

## 6. Token- & Billing-Ablauf

```
Page Load (Owner: skip)
    → ensureBillingRow + hasActiveSubscription (Server)

Client Mount
    → GET /api/dashboard/summary → tokensRemaining, hasActiveSubscription

Vor Generate (Client)
    → calculateGenerationTokenCost(mode, resolution, ref, strict, variants)
    → StudioImageComposer: uiState insufficient | no_sub | ready
    → generate(): optional client-side throw wenn remaining < runCost

Vor Provider (Server)
    → requireTokenBudget / remaining check in create-task

Nach erfolgreichem Render + Upload (Server)
    → consumeTokens(userId, perVariant * successCount)
    → Response billing.consumed, billing.remainingTokens

Nach Response (Client)
    → setTokensRemaining
    → evglab-billing-updated → Shell refreshBillingUi
    → persistMediaBatch (keine Token-Logik)
```

**402-Codes:** `subscription_required`, `insufficient_tokens` → `gateError` → `ComposerSubscriptionModal` / `ComposerTokenBuyDialog`.

**Kein Abort-Rollback:** Bei Client-Abbruch während laufendem fetch gibt es **keinen** `AbortController`; Server kann trotzdem fertig werden und Tokens abbuchen — **Verhalten nicht ändern ohne explizite Produktentscheid**.

---

## 7. Markenprofil-Ablauf

| Phase | Verhalten |
| ----- | --------- |
| Server Props | `brandProfileComplete`, `brandProfileActive`, `brandProfileMode` an Redesign |
| Settings-Load | `GET /api/dashboard/settings` → `brandLabelReferenceUrl`, `brandReferenceImageUrls`, `brandReferenceImagesStale` |
| Modus skip | `etikettModus = "generisch"`, keine Pflicht-Referenz |
| Modus guided / undecided | Callout + `BrandProfileSetupModal`; `referenceImagesStale`-Banner |
| Etikett-Priorität | Composer-Ref > Custom-Upload > Bier-Etikett > Marken-Etikett (`brandLabelReferenceUrl`) |
| strictLabel | Composer-Toggle → erzwingt `etikettModus "marke"` in `generate()` |
| Server | `buildBrandProfilePromptContext(brandProfile)` in create-task; Campaign/Studio eigene Brand-Pfade in Routes |
| Wizard | `showGuidedProminent` wenn Onboarding offen; `startCustomWizard` bei „Guided“ |

---

## 8. Zustandsmatrix (nachweisbar im Code)

| Zustand | Auslöser | Aktuelle Darstellung | Erforderliches Verhalten im Redesign |
| ------- | -------- | -------------------- | ------------------------------------ |
| Initialisierung | Route Mount | Composer leer, Settings/Summary laden | Gleich; Skeleton optional |
| Daten laden | fetch settings/summary/beers | Stille Updates (breweryName, tokens, beers) | Loading-Indikator nur wenn UX-Lücke — **nicht erfunden** |
| Kein Abo (Server) | `!hasActiveSubscription` | `CreateContentLockedView` | Design Locked-State; gleiche CTAs |
| Kein Abo (Client) | `hasActiveSubscription === false` | Generate `uiState: no_sub` → Abo-Modal | Beibehalten |
| Composer leer | `incomplete` (kein Prompt/Ref/Headline) | Generate disabled, `uiState: incomplete` | Design disabled-Styling |
| Hyperreal bereit | Prompt oder styleId | `uiState: ready` | Primary CTA aktiv |
| Studio incomplete | Kein `referenceImageUrl` | disabled + Fehler bei Generate | Upload-Pflicht sichtbar |
| Campaign incomplete | Leere `headline` | disabled | Headline-Feld Pflicht |
| Isolate | Tab `disabled`, comingSoon | Kein Generate | Design: „In Kürze“ — **nicht freischalten** |
| Tokens knapp | `remaining < estimate` | `insufficient` → Token-Buy-Dialog | Design-Hinweis Kosten |
| Generierung läuft | `loading/generating true` | Skeleton-Karten in Feed, Progress in GenerateButton, `generationStep` (Wizard) | Design Loading-Pattern |
| Erfolg | API 200 + images | Feed `status: ready`, `jobSucceeded: true` | Ergebnis-Grid/Lightbox |
| Partial Erfolg | `partial: true` | `setError` Warnung + ready cards | Warnung + Ergebnis |
| API-Fehler | !res.ok (nicht 402) | Feed error card / `setError` | Design Error-Card + Retry |
| Gate 402 | subscription/tokens | `gateError` + Modals | Gleiche Modals, neues Styling |
| Retry | `onRetry` / Feed | erneut `generateFromComposer()` | Ein Handler, kein Doppel-Fetch |
| Referenz veraltet | `brandReferenceImagesStale` | Banner → Brand Setup | Banner-Styling |
| Markenprofil offen | `!profileComplete && mode !== skip` | Callout Markenprofil | Design Callout |
| Markenprofil skip | `brandProfileMode === skip` | Kein Pflicht-Callout, generisch | Respektieren |
| Wizard aktiv | `flowMode === wizard"` | `MarketingPromptCreateShell` | Parallel zum Design-3-Step — **IA-Abweichung dokumentieren** |
| Wizard Review | `isReviewStep` | „In Composer übernehmen" | State in Composer mappen |
| Gespeichert | `persistMediaBatch` ok | `inLibrary: true` auf Cards | Mediathek-Link optional |
| Session Reuse | Mediathek → Create | `APPLY_REUSE` dispatch | Beibehalten |
| Mobile | Shell Bottom-Nav + Composer CSS | Responsive über `evg-form` / Shell | Design Mobile-Create (HANDOFF §5) |

### Nicht vorhanden / spätere Produktentscheid

- **Abbrechen während Generierung** (`AbortController`) — nicht implementiert  
- **Client-Aufruf `/api/analytics/image-flow`** — Route existiert, kein Caller  
- **Rate-Limit-UI** — Server 429, kein dediziertes Client-Pattern nachgewiesen  
- **Auto-Navigation zur Mediathek** nach Erfolg — nicht vorhanden  
- **Design „Logo einbetten“** — nächstes Äquivalent: `strictLabel`, nicht identisch  
- **Design „Fass (bald)“** — Attrappe, nicht übernehmen  
- **Design fest „4 Motive“** — Produktion: `GENERATION_VARIANT_COUNTS` (1/2/3/4 o. ä.)

---

## 9. Design-Mapping (Prototyp → Produktion)

| Finales Design-Element | Bestehendes funktionales Gegenstück | Vorgeschlagene React-Komponente | Risiko |
| ---------------------- | ----------------------------------- | ------------------------------- | ------ |
| Page-Title „Bilder Erstellen" | `StudioImageComposer` header `evg-pagehead` | `StudioPageHeader` / Composer-Header Wrapper | Niedrig |
| Subtitle Markenprofil-Hinweis | `brandLine` + Onboarding-Text | Presentation in Composer-Header | Niedrig |
| Kosten + „X Motive generieren" | `ComposerGenerateButton` (cost, variants) | Styled `ComposerGenerateButton` | **Hoch** — muss `tryGenerate` einmal triggern |
| 2-Spalten-Grid Composer/Ergebnis | Composer + `ComposerResultFeed` untereinander | CSS Grid Wrapper in Redesign | Mittel — Mobile Stack |
| Modus-Tabs (Szene/Studio/…) | `evg-modes` in `studio-image-composer` | Bestehende Tabs, Studio-Tokens | Mittel — `SET_MODE` dispatch |
| Prompt-Textarea | `composer.shared.prompt` | `StudioUiTextarea` / `evg-textarea` | Niedrig |
| Control-Pills (Format, Stil, …) | `ComposerControlPills` | Studio Popover/Pills aus T2b | **Hoch** — State via dispatch |
| „1 · Bier aus Sortiment" Card | Wizard `was` + `selectedBeer` / `my-beers` | Wizard-Step oder Composer-Produkt-Pill | Mittel — IA-Abweichung zum Composer-first |
| „2 · Anlass" Chips | Wizard `wo`/`occasionNote` + Templates | `MarketingChoicePills` / Occasion-UI | Mittel |
| „3 · Format & Menge" | Composer `aspectRatio`, `variantCount`, Ref-Upload | `ComposerControlPills` | Mittel |
| Referenz-Upload Dropzone | `composer-reference` API + Pills | Bestehender Upload-Flow | **Hoch** — Storage-URL in State |
| Ergebnis-Karten-Grid | `ComposerResultFeed` / `sessionCards` | Feed-Karten neu stylen | Mittel |
| Loading Shimmer 2×2 | Feed `status: loading` + GenerateButton fill | Design Skeleton | Niedrig |
| Error-Card + Retry | Feed error + `onRetry` | Styled Error Panel | Niedrig |
| Token „nicht belastet" bei Fehler | Server: kein consume bei 0 Bildern | Copy im Error-State | Niedrig — Text aus Server-Verhalten |
| CHARGE-Anzeige | `formatChargeNumber(nextChargeNumber)` | Mono-Badge in Header | Niedrig |
| Abo-Locked Screen | `CreateContentLockedView` | Studio Empty/Locked Layout | Niedrig |
| Bottom-Nav Mobile | `DashboardStudioShell` | Shell T3 — **nicht in T5 anfassen** | — |

### Prototyp-Attrappen (nicht übernehmen)

- Statische Sorten-/Anlass-Daten ohne API  
- Feste „30 Tokens" / „4 Motive" ohne `calculateGenerationTokenCost`  
- „Fass (bald)" Gebinde  
- Fake-Ergebnisbilder in HTML  
- `/create/image`-Routing (Produktion: `/inhalte-erstellen`)

### Ohne echte Datenquelle im Design

- Live Token-Stand (kommt aus `/api/dashboard/summary`)  
- Charge-Nummer (aus Summary `nextChargeNumber`)  
- Echte generierte Bild-URLs (Storage signed)  
- Bier-Sortiment (`/api/dashboard/my-beers`)

---

## 10. Größte Risiken für T5b–T5e

1. **Doppelte Generierung** — neues Layout mit zusätzlichem Submit + Composer-Form-Submit.  
2. **Token-Doppelbuchung** — paralleler „Kauf"/Generate-Flow oder Retry ohne `loading`-Guard.  
3. **Composer-State-Verlust** — Wizard/Composer-IA umbauen ohne `composerReducer`-Vertrag.  
4. **Hyperreal-Pfad vermischen** — Studio-Locks in Hyperreal-`generate()` (AGENTS.md).  
5. **Referenz-URL-Handling** — Custom Data-URL vs Storage-URL vs Brand-Label.  
6. **Partial-Response** — UI, die bei `partial` alle Karten verwirft.  
7. **Orphan Legacy** — `Mode*.tsx` / `generate-hyperrealistic` nicht aus Versehen reaktivieren.  
8. **Working Tree** — parallele API-Änderungen nicht mit T5-UI vermischen.

---

## 11. Empfohlene T5-Aufteilung

### T5b — Äußeres Composer-Layout & responsive Struktur

| | |
| - | - |
| **Ziel** | 2-Spalten Desktop (Composer \| Feed), Mobile Stack, Page-Header gemäß Handoff |
| **Erlaubt** | `inhalte-erstellen-redesign.tsx` (Layout-Wrapper only), `studio-image-composer.tsx` (markup/classes), neue CSS unter `src/styles/studio-create*.css`, Design-Handoff Screens |
| **Geschützt** | Alle `generate*`-Funktionen, API, composer-state, persistMediaBatch |
| **Risiko** | Mittel — Grid/Overflow bricht Feed-Lightbox |
| **Tests** | `npm run build`; manuell 1440/768/390 |
| **Screenshots** | `_t5-preview/01-create-desktop.png`, `02-create-mobile.png` |
| **Stop** | Layout approved, keine Handler-Änderung |

### T5c — Form-Controls → Studio-Primitives

| | |
| - | - |
| **Ziel** | Mode-Tabs, Pills, Textarea, Modals auf T2b-Primitives (`StudioUi*`, Popover) |
| **Erlaubt** | `composer-control-pills.tsx`, `composer-generate-button.tsx`, `composer-subscription-modal.tsx`, `composer-token-buy-dialog.tsx`, Styles |
| **Geschützt** | `composer-state.ts`, `composerReducer`, Zod, dispatch-Action-Typen |
| **Risiko** | Hoch — Pills müssen weiterhin `dispatch` nutzen |
| **Tests** | Bestehende Vitest unverändert grün; Pill-Interaktion manuell je Modus |
| **Screenshots** | Popover Format/Stil/Produkt (Handoff step3b-Referenzen) |
| **Stop** | Alle 3 aktiven Modi konfigurierbar, Isolate weiterhin disabled |

### T5d — Generierungs-, Loading-, Error- & Ergebnis-Zustände

| | |
| - | - |
| **Ziel** | Feed loading/error/ready, GenerateButton progress, Gate-Modals, Locked-View Styling |
| **Erlaubt** | `composer-result-feed.tsx`, `composer-generate-button.tsx`, `create-content-locked-view.tsx` (Presentation), Error-Banner in Redesign |
| **Geschützt** | `generate`, `generateFromComposer`, API-Routen, `consumeTokens`, `persistMediaBatch` Signatur |
| **Risiko** | **Sehr hoch** — Retry muss identischen Handler aufrufen |
| **Tests** | Manuell: 402 both codes, partial success, network error; `npm test` |
| **Screenshots** | Loading, Error, Success, Insufficient Tokens |
| **Stop** | Kein Token-Leak bei Fehler; Retry funktioniert |

### T5e — Motion, Microinteractions & visuelle QA

| | |
| - | - |
| **Ziel** | ETA-Bar, reduced-motion, Onboarding-Hints Position, Handoff-Pixel-QA |
| **Erlaubt** | `composer-job-eta.ts` (nur UI-Kopplung), CSS transitions, onboarding-hints Position |
| **Geschützt** | Billing, Prompt, API |
| **Risiko** | Niedrig |
| **Tests** | `prefers-reduced-motion`, Screenshot-Matrix |
| **Screenshots** | Volle `_t5-preview/` Serie |
| **Stop** | Visuelle Abnahme |

---

## 12. T4.1 ESLint-Zuordnung

**Geprüfte Dateien (T4.1):**

- `dashboard-home-utils.ts` — ✅ 0 Befunde  
- `dashboard-home-utils.test.ts` — ✅ 0 Befunde  
- `dashboard-home-view.tsx` — ✅ 0 Befunde  
- `dashboard-redesign.tsx` — ⚠️ 7 Errors, 13 Warnings (**vorbestehend**, u. a. `set-state-in-effect`; T4.1 fügte nur CSS-Import hinzu)  
- `page-client.tsx` — ⚠️ 1 Error: `react-hooks/purity` Zeile 489 (`Date.now()` in Render)

**Zuordnung Baseline 3483 → 3484:**

- T4.1-Diff (`c4adec0..cbf6f46`) ändert in `page-client.tsx` **nur Mock-Konstanten** (`chargesTotal`, `MOCK_DAILY_TOKEN_COSTS`); die `Date.now()`-Zeile 489 existierte **bereits in T4** (`c4adec0`).  
- Neue Datei `dashboard-home-utils.test.ts` ist ESLint-sauber.  
- **Fazit:** T4.1 hat **keinen neuen ESLint-Befund** verursacht. Die +1 Gesamt-Baseline ist **nicht kausal auf T4.1** zurückführbar (messbarer Gesamt-Repo-Stand inkl. anderer geänderter Dateien im Working Tree / vorbestehende Befunde).

**Kein separater T4.1-Lint-Fix-Commit erforderlich.**

---

## 13. Verbindliche Schutzliste (T5)

Nicht verändern:

- Prompt-Builder, Prompttexte, Claude-Skill-Pfade  
- API-Routen und Request/Response-Verträge  
- Supabase, Migrationen, RLS  
- Auth, Middleware, 2FA  
- Billing, Token, Abonnement (`consumeTokens`, `generationBilling`)  
- Zod-Schemas in `schemas.ts`  
- Mediathek-Persistenz (`/api/dashboard/media`, `media-store`)  
- `next.config.*`, Lockfiles  
- `src/components/ui/**` Shared (laut Vorgabe) **außer** ausdrückliche Freigabe — *Hinweis:* Produktions-Create liegt derzeit in `inhalte-erstellen-redesign.tsx` unter `ui/`; T5b–d benötigen **explizite Freigabe** für presentation-only Änderungen an dieser Datei  
- Dashboard/Shell T3/T4  
- Keine neuen npm-Packages

---

## 14. Referenzen

- Modus-Dokumentation: `src/app/(dashboard)/inhalte-erstellen/README.md`  
- AGENTS.md: Ultra Realistic ≠ Studio Produktbild  
- Design: `BrewAI-Cursor-Handoff/HANDOFF.md` §4 `/create/image`, `BrewAI Studio Final.dc.html` (Zeilen ~446–570)

---

*T5a abgeschlossen. T5b erst nach ausdrücklicher Freigabe.*
