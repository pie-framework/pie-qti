---
'@pie-qti/transform-core': patch
'@pie-qti/pci-runner': patch
'@pie-qti/pie-to-qti2': patch
'@pie-qti/player-elements': patch
'@pie-qti/to-pie': patch
---

Correct published dependency graphs: runtime imports no longer hide in `devDependencies`, and test-only packages no longer ride along as production dependencies. `@pie-qti/player-elements` now declares `@pie-qti/qti-common` and `@pie-qti/default-components` (both imported at runtime from its entry points) in `dependencies`; `@pie-qti/pci-runner` likewise declares `@pie-qti/item-player`. `@pie-qti/core` moves `@pie-qti/test-utils` and `@pie-qti/to-pie` moves `@pie-qti/transform-core` to dev dependencies (tests only), and `@pie-qti/pie-to-qti2` drops `@pie-qti/transform-core` entirely (only a type import remained, now satisfied by `@pie-qti/transform-types`). Installing these packages no longer pulls unnecessary extras, and bundlers without hoisting-dependent resolution keep working. The `check:deps` script now flags runtime value imports of workspace packages that are not declared in `dependencies`/`peerDependencies` of publishable packages.
