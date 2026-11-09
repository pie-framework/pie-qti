---
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
---

Association and placement caps follow the QTI "0 means unlimited" reading and every refusal is announced (WCAG 3.3.1/3.3.2/4.1.3):

- **graphicAssociateInteraction**: an explicit `maxAssociations="0"` and a hotspot `matchMax="0"` now mean unlimited, as the delivery engine and the sibling pairing surfaces already read them. Previously no pair could ever form under `maxAssociations="0"` (every second click announced "the limit of 0 is reached") and a `matchMax="0"` hotspot was refused by name. An unlimited hotspot's accessible name states its usage as unlimited instead of "(n/0 connections)", and the associations counter drops the "/0" maximum.
- **positionObjectInteraction**: a placement refused at a cap (keyboard Enter on the crosshair, click/tap on the canvas, or a drag drop) is announced through the polite live region ("The maximum of {max} placements is reached.") instead of visibly doing nothing, and pressing Enter again re-announces it; the placement mode stays active so Escape still cancels. The "Maximum: {maxChoices}" hint now shows whenever `maxChoices > 0`, not only when the item also declares a minimum.
- **associateInteraction**: activating a partner the `matchGroup` rule forbids announces "Not available due to a match group restriction." instead of being silently ignored.
- **matchInteraction**: the two refusal cases are split and named like the associate family — the interaction cap ("Association not possible: the limit of {max} is reached.") and a source at its `matchMax` ("Not possible: {label} cannot be in more associations.") — replacing the generic "Maximum associations reached" message; repeating the same refused attempt announces again.
- **i18n**: new keys across all 8 locales: `interactions.graphicAssociate.hotspotConnectionsUnlimited` and `associationsCountUnlimited`, `interactions.positionObject.maxChoicesReached` (plural group) and `objectLimitReached`, `interactions.associate.notAvailableSentence`, `interactions.match.associationLimitReached` and `sourceLimitReached`. The unused `interactions.match.maxReached` key is removed.
