---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
---

Apply the QTI `shuffle` attribute with a session-seeded Fisher-Yates shuffle.

`shuffle` was parsed for `choiceInteraction`, `orderInteraction`, `matchInteraction`,
`associateInteraction`, `gapMatchInteraction` and `inlineChoiceInteraction`, but only
`orderInteraction` acted on it — and that implementation was effectively a no-op. It
seeded a non-iterated LCG from a sum of the `responseIdentifier`'s character codes; a
±1 seed change moved the generator's output by less than one bucket width, so across
600 realistic identifiers it produced 3 distinct permutations out of 720, one of them
83% of the time. The character-code sum also collided on anagrams (`"AB"`/`"BA"`).

Shuffling now happens once at extraction time for all six interactions, using
`createSeededRng` (mulberry32) seeded from an FNV-1a hash of the item session GUID and
the `responseIdentifier`:

- Different candidates and different attempts get different orders, so `shuffle` again
  serves its purpose of reducing position bias and answer copying. Previously every
  candidate saw the same order for a given item.
- The order is stable for the whole session, including across re-renders and reloads,
  because `Player` already persists and restores the session GUID — no new session
  field was required.
- `fixed="true"` choices keep their authored index and only the remaining choices are
  permuted around them. This was previously extracted but ignored.
- `matchInteraction`'s two sets are shuffled independently.

`OrderInteraction.svelte` no longer shuffles: doing so on top of the extraction-time
shuffle would re-order on every re-render.

Interaction PRDs have been corrected — several claimed "✅ Full … shuffles at
extraction time" when no shuffling occurred, and claimed `fixed` was not extracted when
it was.
