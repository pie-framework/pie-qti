---
'@pie-qti/to-pie': patch
---

Clear all 32 Dependabot advisories on the default branch.

Thirty of them were stale nested lockfile resolutions. Every affected range already
admitted its fix, but `bun update` refuses to move a nested entry that still satisfies
its parent's range, so the lockfile was regenerated: `minimatch` 5.1.6 to 5.1.9 and
9.0.5 (dropped, now shares the hoisted 10.2.6), `picomatch` 2.3.1 to 2.3.2 and 4.0.3 to
4.0.5, `brace-expansion` 2.0.2 to 2.1.4 and 5.0.5 (dropped), `js-yaml` 3.14.2 to 3.15.1
and 4.1.1 to 4.3.1, `fast-uri` 3.1.0 to 3.1.5. The regeneration also collapses seven
duplicate subtrees, which is most of the 519-line lockfile reduction.

`cookie` needed a root `overrides` entry. `@sveltejs/kit` declares `^0.6.0` and still
does at 2.70.2, its latest, so no upgrade reaches 0.7.0. Kit imports only `parse` and
`serialize`, both signature-compatible, and the override is pinned to 0.7.2. Bun ignores
nested `resolutions`, so a flat override is the only mechanism available; it is safe here
because `cookie` has exactly one copy in the tree.

`image-size` has no upstream fix — 2.0.2 is current and both advisories name it. They are
reachable: `to-pie` measures images out of ingested QTI packages, so a crafted `.icns` or
`.heic` in a package hangs the converter's event loop. `getImageDimensions` now calls
`disableTypes(['heif', 'icns', 'jxl', 'jxl-stream'])`, which rejects those formats during
detection before the looping `calculate()` runs; the `validate()` functions still reached
are loop-free. Detection failures for a disabled or unrecognised format no longer log as
errors, since callers already treat an unmeasured image as having no dimensions. The two
alerts stay open until upstream patches, and the disabled list is the thing to shorten
when it does.
