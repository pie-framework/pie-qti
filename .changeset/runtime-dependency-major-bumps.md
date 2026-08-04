---
'@pie-qti/transform-core': minor
'@pie-qti/to-pie': minor
'@pie-qti/item-player': minor
'@pie-qti/test-utils': minor
'@pie-qti/demo-vendor-extensions': minor
'@pie-qti/assessment-player': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/pie-to-qti2': patch
'@pie-qti/transform-cli': patch
'@pie-qti/default-components': patch
'@pie-qti/typeset-katex': patch
---

Update the third-party runtime dependencies that ship to consumers.

**`node-html-parser` moves from `^6.1.13`/`^7.0.x` to `^9.0.1`.** This affects
`transform-core`, `to-pie`, `item-player`, `test-utils`, `demo-vendor-extensions`,
`assessment-player`, `ims-cp-core`, `pie-to-qti2` and `transform-cli`.

Five of those packages name the dependency in their published type declarations rather
than wrapping it — `transform-core`, `to-pie`, `item-player`, `test-utils` and
`demo-vendor-extensions` all emit `import type { HTMLElement } from 'node-html-parser'`
into their `.d.ts`. Because the parser's own types are part of our public surface there,
crossing three majors is a type-surface change for consumers and not an internal detail,
so those packages take a `minor`.

If you resolve `node-html-parser` yourself and exchange parsed elements with these
packages, move to `9.x`. Pinning an older major leaves two copies of `HTMLElement` in the
type graph, and structurally incompatible ones will not assign to each other. Consumers
that only pass QTI strings in and take converted output back out are unaffected.

**`katex` moves from `^0.16.27` to `^0.18.1`** in `typeset-katex`, **`mathlive` from
`^0.108.2` to `^0.110.0`** in `item-player` and `default-components`, and
**`@tiptap/core` from `^3.15.3` to `^3.29.2`** in `default-components`. None of these
appear in published declarations, so they carry no type-surface change and take a
`patch`. Applications that load their own copy of KaTeX or MathLive alongside ours should
still check the pairing, since both ship stylesheets and fonts.

All publishable packages release as one fixed-version set, so the whole set moves to the
highest bump declared here.
