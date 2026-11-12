---
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
'@pie-qti/item-player': patch
---

Graphic interactions close their spec gaps: hotspot multiple selection, the hotspot `default` shape, graphic order's areas on the image, and graphic associate's per-shape hit areas.

**Hotspot multiple selection.** A `hotspotInteraction` whose `maxChoices` is above `1`, or `0` for no restriction (QTI 3.0 §5.68.2 binds those to a multiple-cardinality response), now answers with the list of selected regions instead of behaving as single selection. Each region is an `aria-pressed` toggle button: activating it toggles it. At `maxChoices` a further selection is refused — nothing changes, nothing is emitted — and the limit is announced politely, using the author's `data-max-selections-message`, else `interactions.hotspot.maxChoicesReached` (new i18n key; the text `choiceInteraction` and hottext use). "Clear answer" clears every region and emits `[]`; a restored array response (including a single selection bound to a multiple response) shows its regions. `minChoices` stays enforced by `Player.validateResponses()`, and the hint counts every selected region. Single selection (`maxChoices=1`) is unchanged.

**Hotspot `default` shape.** QTI 3.0 §8.29 defines the `default` shape as "the entire area of the associated image". `HotspotShape` now draws it as a full-image region, painted beneath every other region so another region's click stays its own, reached by keyboard and named like any region (`hotspotLabel`, else "Region N of M"). The hotspot extractor accepts a default-shape choice without `coords`; every other shape still requires them. Graphic gap match draws its hotspots with the same `HotspotShape`, so a default-shape hotspot there now covers the whole image too (painted in authored order) instead of drawing nothing.

**Graphic order shows its areas.** QTI 3.0 §5.61: "The delivery engine must clearly indicate all defined area(s) of the image." An SVG overlay in the image's pixel space outlines every hotspot and gives each placed one its position in the order, so a candidate can tell which area a list entry names. The overlay is visual only (`aria-hidden`, no pointer input); the ordering list and its controls are unchanged, and it scales with the image on small screens.

**Graphic associate hit areas are the hotspot shapes.** QTI 3.0 §5.7.5–5.7.6: a hotspot is the area its `shape` and `coords` describe. Each hotspot button now takes no pointer input over its bounding box; the `HotspotShape` drawn inside it does, so a press inside a polygon's bounding box but outside the polygon no longer selects it. The buttons stay the keyboard and assistive-technology controls with their focus indicators, and the image shows each hotspot's real outline and state.

**Correct-answer mode.** Hotspot, graphic order and graphic associate now take correct-answer mode from `createInteractionShell` (`role === 'scorer'` with a correct response), like the other interactions; previously a scorer view of an item without a correct response rendered in correct-answer mode (in practice invisible, since the flagged lists were empty — now pinned by tests).

`InteractionValueMap.hotspotInteraction` is retyped to `string | string[] | null` to match what the component emits (a follow-up to the phase 2 value-type changes). Hosts that type `qti-change` handlers through that map must accept the list form.
