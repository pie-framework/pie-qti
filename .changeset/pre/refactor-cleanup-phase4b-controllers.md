---
'@pie-qti/default-components': patch
---

Phase 4b of the player cleanup: shared pick-up/place, pair, matchGroup and capacity rules for the drag-and-drop, pairing and selection interactions, and one capacity reading for malformed limits.

**A limit that is not a number no longer blocks an interaction.** A non-numeric `maxChoices`, `maxAssociations` or `matchMax` (for example `maxChoices="any"`) reaches the components as `NaN`. Hottext, position object and graphic associate read it as "nothing more allowed" — every selection, placement or association was refused, and position object announced that the object "cannot be placed again" — and a match source with such a `matchMax` could not be dragged, while every other interaction read it as no restriction. Every interaction now applies one rule: only a positive limit restricts, and 0 means no restriction (as QTI 2.2 and 3.0 define it).

**A blank `data-max-selections-message` falls back to the default message.** An authored message of only spaces gave choice, hottext and hotspot an empty alert at their limit (and hotspot an empty refusal announcement), and match an empty alert, while gap match and graphic gap match already fell back to the localized default. All now state the author's message when it has text — trimmed — and otherwise the default; choice, hottext and hotspot still state the default only where a further selection is refused (a limit above 1).

Valid limits and authored messages behave as before. The extractor defaults the components receive (`maxChoices`, `maxAssociations`, `matchMax`, absent, 0 or set) are unchanged and now frozen by a test.

`@pie-qti/default-components/shared` adds `placeSourceOnTarget` (place a source on a target in a directed-pair response: the target's previous pair is replaced, a source below its capacity is reused and one at its capacity moves), `countPairsForSource` and `hasUnorderedPair`; `removePairBySource` and `removePairByTarget` now accept readonly arrays. All additions; nothing moved or disappeared.

Under the hood, move-only and pinned before and after: gap match, graphic gap match, match and the sortable list share one pick-up/place controller (what is held, what a drop would place, a refused placement keeps the item held); gap match and graphic gap match place pairs through the new move-aware helper (graphic gap match always moves a placed label, so a label dropped from one hotspot onto another leaves exactly that one pair); the five pairing interactions mark matchGroup-blocked targets through one helper on the rule response validation applies, with golden tests that the UI blocks exactly the pairs validation rejects; and the nine selection and association interactions share one capacity and limit-message helper.
