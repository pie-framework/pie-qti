# @pie-qti/item-player

## 0.1.18

### Patch Changes

- 2ebee31: Scope QTI stylesheets with an at-rule-aware walker, so `@media` conditions are no longer dropped.

  `scopeCssRules` matched rules with `([^{}@]+)\{([^{}]*)\}`. Excluding `@` from the selector
  pattern kept the scope from being glued onto an at-rule, but it did not make the walker
  understand at-rules, and the failure that remained is worse than a visibly broken selector.

  An `@media` block never matched as a unit, so its inner rules matched on their own and were
  emitted **without the condition**. A `@media print` rule therefore applied on screen as well,
  and a narrow-viewport rule applied at every width — valid CSS that silently renders in the
  wrong places, which is harder to notice than a rule that fails outright. `@supports` behaved
  the same way. `@keyframes spin { 0% { … } }` had its percentage selectors scoped into
  `[scope] 0%` and lost the animation name, so the animation could not run, and `@font-face`
  became `[scope] font-face`.

  Scoping now walks the stylesheet brace-by-brace:

  - `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
    their inner rules scoped, recursively.
  - `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
    `@counter-style` pass through untouched, as do at-rules the walker does not recognise.
  - Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
    a `,` inside `:is(a, b)` does not split a selector list. Comment stripping is string-aware
    too, so a literal `content: "/*"` survives where the previous regex strip corrupted it.
  - Style-rule blocks are emitted verbatim, which is what native CSS nesting needs: nested
    selectors are relative to a parent that has already been scoped.

  `:root`, `html` and `body` are still replaced by the scope selector rather than prefixed, and
  now preserve whatever followed them — `html.dark .a` becomes `[scope].dark .a` instead of
  discarding the `.dark` compound.

  One deliberate behaviour change beyond at-rules: **a leading pseudo is now scoped as a
  descendant rather than attached.** `:is(.a, .b) .c` becomes `[scope] :is(.a, .b) .c`, not
  `[scope]:is(.a, .b) .c`. The authored selector means "some element matching `.a` or `.b`", so
  attaching it required the item body itself to carry the authored class, which it does not.
  The same applies to `:hover` and `::selection`.

  **This both adds and removes rendering.** At-rules have never applied correctly, so some
  styles start applying — but `@media` rules that currently apply unconditionally will now
  apply only behind their real condition, so styles that render today may stop. That is the
  fix, and it is worth eyeballing against real content: a print stylesheet that appeared to
  work on screen was never meant to.

  Flat selector rules scope exactly as before, and `isBlockedStylesheetCss` still rejects any
  stylesheet containing `url(` or `@import` before scoping runs, so `@font-face` with a real
  `src` never reaches this path in practice.

  - @pie-qti/i18n@0.1.18
  - @pie-qti/ims-cp-core@0.1.18
  - @pie-qti/qti-common@0.1.18
  - @pie-qti/qti-processing@0.1.18

## 0.1.17

### Patch Changes

- 76311bb: Update the third-party runtime dependencies that ship to consumers.

  **`node-html-parser` moves from `^6.1.13`/`^7.0.x` to `^9.0.1`.** This affects
  `transform-core`, `to-pie`, `item-player`, `test-utils`, `demo-vendor-extensions`,
  `assessment-player`, `ims-cp-core`, `pie-to-qti2` and `transform-cli`.

  Worth knowing if you resolve `node-html-parser` yourself: five of those packages name it in
  their published type declarations rather than wrapping it — `transform-core`, `to-pie`,
  `item-player`, `test-utils` and `demo-vendor-extensions` all emit
  `import type { HTMLElement } from 'node-html-parser'` into their `.d.ts`, so the parser's
  own types are part of their public surface and this jump crosses three majors.

  If you exchange parsed elements with those packages, move to `9.x`. Pinning an older major
  leaves two copies of `HTMLElement` in the type graph, and structurally incompatible ones
  will not assign to each other. Consumers that only pass QTI strings in and take converted
  output back out are unaffected.

  **`katex` moves from `^0.16.27` to `^0.18.1`** in `typeset-katex`, **`mathlive` from
  `^0.108.2` to `^0.110.0`** in `item-player` and `default-components`, and
  **`@tiptap/core` from `^3.15.3` to `^3.29.2`** in `default-components`. None of these
  appear in published declarations. Applications that load their own copy of KaTeX or
  MathLive alongside ours should still check the pairing, since both ship stylesheets and
  fonts.

  All publishable packages release as one fixed-version set, so the whole set moves together.

- Updated dependencies [9b1e118]
- Updated dependencies [76311bb]
  - @pie-qti/i18n@0.1.17
  - @pie-qti/ims-cp-core@0.1.17
  - @pie-qti/qti-common@0.1.17
  - @pie-qti/qti-processing@0.1.17

## 0.1.16

### Patch Changes

- 3c56bd9: Generate identifiers from a CSPRNG and fix a non-uniform shuffle.

  - `item-player`: `createSessionGuid` previously fell back to `Math.random()` when
    `crypto.randomUUID` was unavailable — which is precisely the case when the player is
    served over plain HTTP, since `randomUUID` is restricted to secure contexts. It now
    falls back to `crypto.getRandomValues`, and throws a descriptive error if no Web Crypto
    API is present at all rather than silently producing predictable session GUIDs.
  - `ims-cp-node`: temporary extraction directories are now created with `fs.mkdtemp`
    instead of a `Date.now()` + `Math.random()` name. The old name was predictable and was
    built before the directory was created, so a local attacker could pre-create the path or
    plant a symlink there. `mkdtemp` creates the directory atomically with mode `0700`
    (previously `0755`, i.e. readable by other local users).
  - `assessment-player`: `ReferenceBackendAdapter` item-bank selection used
    `sort(() => Math.random() - 0.5)`, which is not a uniform shuffle — measured over 60k
    trials it left the first element in place 21.9% of the time against an expected 16.7%.
    Replaced with the Fisher-Yates helper already used by `AssessmentPlayer`.

- 5a4e39a: Normalize `repository.url` to the `git+https://` form.

  npm was rewriting this field at publish time and warning about it:

  ```
  npm warn publish "repository.url" was normalized to "git+https://github.com/pie-framework/pie-qti.git"
  ```

  Beyond silencing that warning, npm requires `repository.url` to match the GitHub
  repository exactly when generating provenance attestations, so this is a prerequisite
  for moving publishing to trusted publishing (OIDC). No runtime or API change.

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- f4655e6: Apply the QTI `shuffle` attribute with a session-seeded Fisher-Yates shuffle.

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

- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
  - @pie-qti/i18n@0.1.16
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/qti-common@0.1.16
  - @pie-qti/qti-processing@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.15
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/qti-common@0.1.15
  - @pie-qti/qti-processing@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
  - @pie-qti/i18n@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
  - @pie-qti/qti-common@0.1.14
  - @pie-qti/qti-processing@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.13
  - @pie-qti/ims-cp-core@0.1.13
  - @pie-qti/qti-common@0.1.13
  - @pie-qti/qti-processing@0.1.13
  - @pie-qti/typeset-katex@0.1.13

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.

  - @pie-qti/i18n@0.1.12
  - @pie-qti/ims-cp-core@0.1.12
  - @pie-qti/qti-common@0.1.12
  - @pie-qti/qti-processing@0.1.12
  - @pie-qti/typeset-katex@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.11
  - @pie-qti/ims-cp-core@0.1.11
  - @pie-qti/qti-common@0.1.11
  - @pie-qti/qti-processing@0.1.11
  - @pie-qti/typeset-katex@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.10
  - @pie-qti/ims-cp-core@0.1.10
  - @pie-qti/qti-common@0.1.10
  - @pie-qti/qti-processing@0.1.10
  - @pie-qti/typeset-katex@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.9
  - @pie-qti/ims-cp-core@0.1.9
  - @pie-qti/qti-common@0.1.9
  - @pie-qti/qti-processing@0.1.9
  - @pie-qti/typeset-katex@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.8
  - @pie-qti/ims-cp-core@0.1.8
  - @pie-qti/qti-common@0.1.8
  - @pie-qti/qti-processing@0.1.8
  - @pie-qti/typeset-katex@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.7
  - @pie-qti/ims-cp-core@0.1.7
  - @pie-qti/qti-common@0.1.7
  - @pie-qti/qti-processing@0.1.7
  - @pie-qti/typeset-katex@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.6
  - @pie-qti/ims-cp-core@0.1.6
  - @pie-qti/qti-common@0.1.6
  - @pie-qti/qti-processing@0.1.6
  - @pie-qti/typeset-katex@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.5
  - @pie-qti/ims-cp-core@0.1.5
  - @pie-qti/qti-common@0.1.5
  - @pie-qti/qti-processing@0.1.5
  - @pie-qti/typeset-katex@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.4
  - @pie-qti/ims-cp-core@0.1.4
  - @pie-qti/qti-common@0.1.4
  - @pie-qti/qti-processing@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.3
  - @pie-qti/ims-cp-core@0.1.3
  - @pie-qti/qti-common@0.1.3
  - @pie-qti/qti-processing@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.2
  - @pie-qti/ims-cp-core@0.1.2
  - @pie-qti/qti-common@0.1.2
  - @pie-qti/qti-processing@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/qti-processing@0.1.1
