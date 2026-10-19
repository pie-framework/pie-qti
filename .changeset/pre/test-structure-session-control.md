---
'@pie-qti/assessment-player': patch
'@pie-qti/player-elements': patch
---

Test structure semantics: the backend draws selection (with replacement clones) and ordering (with `keepTogether`) at session start and stores the draw; preconditions and item, section and test part branch rules decide `nextItemIdentifier`; item session control cascades per item and the backend enforces `maxAttempts` and `allowComment`; an expired test part, section or item limit locks that scope. A backend must now return the drawn assessment and the first eligible item as `InitSessionResponse.currentItemIdentifier`. The player's `rng` option is ignored; pass it to `new ReferenceBackendAdapter({ rng })`.
