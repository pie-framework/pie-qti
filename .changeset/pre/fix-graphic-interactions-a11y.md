---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Graphic interactions: WCAG 2.2 AA fixes for hotspot, graphic order, graphic associate, graphic gap match, select point, position object and drawing.

**Authored image alternatives are no longer discarded (WCAG 1.1.1).** The extractors now carry the author's text alternative to the renderers: the `<object>` fallback text (QTI 2.x), `<img alt>` (QTI 3.0 content, where `alt=""` marks the image decorative), `aria-label`/`aria-labelledby`/`aria-describedby` on the image (references resolved), and inline SVG `<title>`/`<desc>` (as name and long description). Every graphic renderer now presents the background image with that alternative — or a localized generic name as a last resort — instead of a placeholder like "Hotspot interaction"; decorative images get `alt=""`. Images that fail to load show a localized message with their alternative text.

**QTI identifiers never reach assistive technology.** Hotspot regions are named by their authored `hotspotLabel` or a localized ordinal ("Region 2 of 4"); graphic-order items, graphic-associate hotspots, graphic-gap-match labels and position objects likewise fall back to localized ordinals/generic names instead of their identifiers, which could reveal the answer key. Selected-region summaries, scorer views and remove buttons use these names too.

**Region visibility, focus and selection states (WCAG 1.4.1, 1.4.11, 2.4.7).** Hotspot and graphic-gap-match regions draw a light halo under a dark outline so the boundary shows on any image (`qti-selections-light`/`qti-selections-dark` supported); keyboard focus draws a high-contrast ring; selection adds a thicker outline plus a check marker or stripe pattern, so state never relies on colour alone; hard-coded colours are replaced by theme tokens (`--pie-qti-border-strong`, `--pie-qti-focus`, `--pie-qti-*-text`). The hotspot max-selections message now uses the accessible warning text colour (was 1.76:1).

**Small hotspot regions get a 24×24 CSS px pointer target (WCAG 2.5.8)** via an invisible, non-scaling hit stroke, without changing the scoring geometry.

**Select point is no longer a button containing buttons.** The image area is a labelled `application` surface with documented keyboard crosshair keys; placed points live in an accessible list with "Remove point 2" buttons; placement and removal are announced via a polite live region.

**Reflow (WCAG 1.4.10).** All graphic interaction images scale to their container (up to their natural size), and hotspot/associate/gap-match/position-object overlays map rendered positions back to the image's natural pixel space, so responses stay in the coordinates QTI scores. Position-object placements now record the object's centre point and work on touch via the shared touch-drag helper.

Authoring diagnostics (missing image dimensions) are no longer shown to candidates (console warning; still visible to non-candidate roles), and graphic-order passes its i18n provider to the sortable list so reorder announcements are localized. New `interactions.graphicAssociate` locale section; new keys across all eight locales.
