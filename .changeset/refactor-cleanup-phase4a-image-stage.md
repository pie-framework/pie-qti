---
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
'@pie-qti/item-player': patch
---

Phase 4a of the player cleanup: one shared image stage and keyboard crosshair for the graphic interactions, the declared→natural→refuse sizing rule everywhere, and three graphic accessibility fixes.

**Sizing rule: declared width/height → natural size → refuse.** The graphic stages now resolve their pixel space the same way: the image's declared `width`/`height`, else — for a raster image — its natural size once loaded, else the interaction refuses (no overlay, no placements) and tells authors why: a console warning always, and a `role="alert"` diagnostic outside the candidate role. Coords, points and areaMapping live in image pixel space, so the 500×300 default that select point, graphic order, graphic associate and position object used for images without declared dimensions silently misplaced answers — those items now stage at the image's natural size, and items with neither a declared size nor a loadable image can no longer be answered in a guessed space. The `selectPointInteraction`, `graphicOrderInteraction`, `graphicAssociateInteraction` and `positionObjectInteraction` extractors stop inventing dimensions: the delivered `imageData.width`/`height` are optional now, set only when the item declares them. Position object's draggable object keeps its 50×50 fallback (it sizes a placement box, not a scoring space), as does the drawing interaction's 600×400 canvas (a blank canvas is a valid answer, and the canvas resolution is the response's own pixel size, never a scoring space). New i18n keys (all locales): `interactions.selectPoint.unknownImageDimensions`, `interactions.graphicOrder.unknownImageDimensions`, `interactions.graphicAssociate.unknownImageDimensions`, `interactions.positionObject.unknownImageDimensions`.

**Graphic gap match: a `shape="default"` hotspot now lies beneath the other hotspots** (QTI 3.0 §8.29), like the hotspot interaction's whole-image region — previously it was drawn in authored order and covered every hotspot listed before it, taking their clicks and drops.

**Distinct focus indicator on graphic regions (WCAG 2.4.7).** A region that was both selected and focused showed the focus stroke hidden under the selected outline (its halo grew by half a pixel). One shared rule now draws an offset outer ring — focus-within widens the region's halo layer into a focus-coloured ring around the region on hotspot, graphic gap match (whole-image backdrop included) and graphic associate's buttons take a shared offset outline — distinct from the selected state by geometry, not colour alone, in the theme's `--pie-qti-focus` token.

**Sortable list labels wrap at 320 CSS px (WCAG 1.4.10 Reflow).** The reorderable list's move controls no longer squeeze the item into a clipped sliver on narrow screens: the controls wrap beneath the item and long labels (graphic order's hotspot labels among them) wrap instead of truncating.

Under the hood: the seven graphic stages render through a shared `ImageStage` (media, load tracking, sizing style, one style sheet) and select point and position object share a keyboard crosshair controller — move-only refactors with the existing behaviour pinned before and after; the emitted points and refusals are unchanged for items that declare their image size.
