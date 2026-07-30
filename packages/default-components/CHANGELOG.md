# @pie-qti/default-components

## 0.1.17

### Patch Changes

- 5a4e39a: Normalize `repository.url` to the `git+https://` form.

  npm was rewriting this field at publish time and warning about it:

  ```
  npm warn publish "repository.url" was normalized to "git+https://github.com/pie-framework/pie-qti.git"
  ```

  Beyond silencing that warning, npm requires `repository.url` to match the GitHub
  repository exactly when generating provenance attestations, so this is a prerequisite
  for moving publishing to trusted publishing (OIDC). No runtime or API change.

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

- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [f4655e6]
  - @pie-qti/item-player@0.1.17
  - @pie-qti/i18n@0.1.17
  - @pie-qti/qti-common@0.1.17

## 0.1.16

### Patch Changes

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- Updated dependencies [22db6c6]
  - @pie-qti/item-player@0.1.16
  - @pie-qti/qti-common@0.1.16
  - @pie-qti/i18n@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15

## 0.1.14

### Patch Changes

- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
  - @pie-qti/item-player@0.1.14
  - @pie-qti/i18n@0.1.14
  - @pie-qti/qti-common@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.13
  - @pie-qti/item-player@0.1.13
  - @pie-qti/qti-common@0.1.13

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.

- Updated dependencies [abe0be5]
  - @pie-qti/item-player@0.1.12
  - @pie-qti/i18n@0.1.12
  - @pie-qti/qti-common@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.11
  - @pie-qti/item-player@0.1.11
  - @pie-qti/qti-common@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.10
  - @pie-qti/item-player@0.1.10
  - @pie-qti/qti-common@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.9
  - @pie-qti/item-player@0.1.9
  - @pie-qti/qti-common@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.8
  - @pie-qti/item-player@0.1.8
  - @pie-qti/qti-common@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.7
  - @pie-qti/item-player@0.1.7
  - @pie-qti/qti-common@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.6
  - @pie-qti/item-player@0.1.6
  - @pie-qti/qti-common@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.5
  - @pie-qti/item-player@0.1.5
  - @pie-qti/qti-common@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.4
  - @pie-qti/item-player@0.1.4
  - @pie-qti/qti-common@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.3
  - @pie-qti/item-player@0.1.3
  - @pie-qti/qti-common@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.2
  - @pie-qti/item-player@0.1.2
  - @pie-qti/qti-common@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/item-player@0.1.1
