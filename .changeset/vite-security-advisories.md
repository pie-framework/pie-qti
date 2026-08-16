---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
---

Move the build toolchain to vite 8.2.1, clearing seven advisories.

vite 8.0.10 is covered by advisories against `>=8.0.0 <=8.0.15`, and it carried
`postcss@8.5.12` (`<=8.5.22`), `nanoid@3.3.11` (`<3.3.18`) and `rollup@4.55.1`
(`<4.59.0`) underneath it. `bun audit` goes from 39 advisories to 32, and from 30 high to
25.

Four packages declared a caret range that already admitted the fix and only needed the
lockfile moved; `default-components` pinned `8.0.10` exactly, matching its house style for
devDependencies, so that pin is now `8.2.1`.

The last old copy was `vitest`'s own nested `vite`. vitest 4.1.10 is current and its range
(`^6 || ^7 || ^8`) admits 8.2.1 — the lockfile was simply holding a stale nested
resolution that neither `bun update` nor `bun install --force` re-resolves, so that entry
was dropped and reinstalled.

Vite is a devDependency in all three packages, so nothing about the published output
changes; this is recorded as a patch so the advisory fix appears in the changelog.
