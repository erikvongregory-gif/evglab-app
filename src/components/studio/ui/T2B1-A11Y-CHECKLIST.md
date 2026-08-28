# T2b.1 — Manuelle Accessibility-Checkliste

Route: `/studio-ui-kit` (nur Development)

## Native Controls (ohne Maus)
- [x] Checkbox: Tab → Space toggelt; Label-Klick toggelt einmal
- [x] Checkbox indeterminate: DOM `indeterminate=true`, Space → checked
- [x] RadioGroup: Pfeile/Space (native), Label aktiviert Option
- [x] Switch: Tab → Space; natives `input[type=checkbox][role=switch]` im DOM; `name`/`value` für Submit

## Tabs
- [x] Rollen tablist/tab/tabpanel + aria-selected/controls/labelledby
- [x] Genau ein Tab `tabIndex=0` (aktiv)
- [x] Horizontal: ArrowLeft/Right, Home/End
- [x] Vertical: ArrowUp/Down (via `orientation="vertical"`)

## Dropdown (role=menu)
- [x] Trigger: aria-haspopup=menu, aria-expanded, aria-controls
- [x] Öffnen (Enter/Space): Fokus erstes aktives Item
- [x] ArrowDown/Up, Home/End; Disabled übersprungen
- [x] Enter/Space aktiviert Item und schließt
- [x] Escape → Fokus zurück auf Trigger
- [x] Tab/Shift+Tab schließt ohne preventDefault
- [x] Klick außerhalb schließt (Radix Popover)
- [x] Typeahead (erster Buchstabe)

## Dialog / Toast / Motion
- [x] Dialog: Escape schließt, Fokus zurück zum Trigger
- [x] Toast Success/Error sichtbar (aria-live / alert)
- [x] prefers-reduced-motion: keine Einblend-Animationen (CSS)

## Production
- [x] `/studio-ui-kit` → HTTP 404 via `notFound()` (+ robots noindex)
