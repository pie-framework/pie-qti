---
'@pie-qti/assessment-player': patch
'@pie-qti/assessment-toolkit': patch
'@pie-qti/default-components': patch
'@pie-qti/pie-to-qti2': patch
'@pie-qti/player-elements': patch
'@pie-qti/section-player': patch
'@pie-qti/test-utils': patch
'@pie-qti/to-pie': patch
'@pie-qti/transform-core': patch
---

Align declared dependencies with what shipped code actually imports, enforced by a new `check:dist-dependencies` gate (added to `verify:publish:quick` and `lint:all`):

- `@pie-qti/player-elements` now declares `@pie-qti/default-components`, `@pie-qti/i18n`, and `@pie-qti/section-player` as real dependencies: shipped declarations import their types, so consumer typechecks no longer depend on hoisted installs.
- `@pie-qti/transform-core` no longer installs `@pie-qti/test-utils` (and transitively `@pie-qti/storage`) at runtime; the same cleanup moves build-only `@pie-qti/transform-core` out of `@pie-qti/to-pie` / `@pie-qti/pie-to-qti2` runtime dependencies, drops unused `@tiptap/*` runtime entries from `@pie-qti/default-components` (bundled into its bundle, now devDependencies), and removes never-imported dependencies from `@pie-qti/assessment-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/test-utils`, and `@pie-qti/section-player` (the two `@pie-players` packages that were only ever resolved transitively).
