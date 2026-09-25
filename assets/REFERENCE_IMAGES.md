# Internal generation references

BrewAI can use neutral internal reference images in addition to the customer's
product photo. These files guide geometry only; prompts explicitly prevent their
background, lighting, logos, and text from leaking into the result.

## Storage layout

- `generated-images/bottle-references/<flaschenTyp>.png`
- `generated-images/glass-references/<glasTyp>.png`
- `assets/campaign-references/*.png` (bundled look-only campaign library)
- `assets/reportage-references/*` (bundled candid flash/street look library)
- `assets/premium-references/*` (bundled hospitality/beer-garden look library)

Local development uses the same filenames below `assets/bottle-references/` and
`assets/glass-references/` as a fallback.

Supported glass filenames are:

- `pils_tulpe.png`
- `weizen.png`
- `willibecher.png`
- `masskrug.png`
- `ipa_teku.png`
- `schwenker.png`
- `stange.png`

Use one neutral, high-resolution photograph per shape: centered three-quarter
view, plain background, no branding, no props, no dramatic light, and the full
silhouette visible. Product photos remain the authority for the actual bottle or
can and label. Look and scene references should continue to use the existing
per-generation upload fields.

## Campaign look library

When `photoStyle` is `campaign`, BrewAI attaches up to two images from
`assets/campaign-references/`. They define framing, color, and light only.
Prompts forbid copying the depicted brands, packaging, people, logos, or
lettering. The customer's product photo stays authoritative. Multiple
reference images are sent as `image[]`; a repeated `image` field is rejected.

## Reportage look library

When `photoStyle` is `reportage`, BrewAI attaches look images from
`assets/reportage-references/`. Faces are blurred before upload so only flash
character and candid energy remain; the model must invent new people each time.
Prompts forbid copying people, brands, logos, or lettering. The customer's
product photo stays authoritative.

## Premium look library

When `photoStyle` is `premium`, BrewAI attaches up to two images from
`assets/premium-references/`. They define hospitality calm, soft bokeh, warm
daylight, and crisp glass/bottle materials only. Prompts forbid copying people,
brands, logos, or lettering. The customer's product photo stays authoritative.
