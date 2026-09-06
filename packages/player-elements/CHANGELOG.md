# @pie-qti/player-elements

## 0.1.24

### Patch Changes

- 080f254: Render readable assessment labels before host translations finish loading, and adopt a later context provider without restarting the attempt. Explicitly configured providers continue to take precedence.
- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.
- 10eba70: Keep assessment answers visible after a failed submission, provide a focused retry action, and prevent duplicate submission while a request is pending.
- Updated dependencies [67e4c23]
  - @pie-qti/item-player@0.1.24

## 0.1.23

### Patch Changes

- 4df35b3: Align the `@pie-players` family on 0.3.67 and migrate off the removed packaged-tool factory.
  
  Merging the four `@pie-players` Dependabot bumps individually left the family straddling
  three releases — 0.3.53, 0.3.65 and 0.3.66 — and those packages pin each other at exact
  versions, so the tree carried parallel copies of five of them. `pie-context` was installed
  twice, which means two independent context instances: a provider registered through one is
  invisible to consumers of the other.
  
  The stale 0.3.53 pin was load-bearing rather than merely untidy. `createPackagedToolRegistry`
  was removed from `pie-assessment-toolkit` in 0.3.65, and `QtiToolButtonBar` still imported
  it, so the build only worked because the duplicate 0.3.53 copy was still resolvable.
  
  Upstream moved the concrete tool registrations out of the toolkit core into
  `@pie-players/pie-default-tool-loaders`, which hard-depends on all eleven packaged tools and
  whose `PACKAGED_TOOL_REGISTRATIONS` references every one statically. Importing its
  `createPackagedToolRegistry` therefore pulled nine unused tool packages into the
  `player-elements` bundle. Instead the two registrations this player actually uses are
  imported individually and installed onto a `ToolRegistry` directly, with a two-entry tag map
  standing in for the default the toolkit no longer ships. No unused tool chunks are emitted.
  
  `player-elements` had a `sideEffects` entry of `./dist/tag-names-*.js` — a rolldown chunk
  name derived from an upstream module, not a source filename. At 0.3.67 that code merges into
  `./dist/define-*.js`, so the entry stopped resolving and the publish check failed; the entry
  and the test asserting it now name the define chunk. The glob remains coupled to upstream
  chunk naming and will need the same treatment on a future reshuffle.
  
  Two `section-player` e2e assertions were checking a workaround rather than a behaviour. The
  toolkit used to render a vendored `nds-icon-button` whose FontAwesome Pro glyph 404ed,
  leaving a blank button that `QtiToolButtonBar` patched with an inline SVG. Those icons are
  licensed to Renaissance products only, so PIE-785 made them opt-in behind `ndsIcons` in
  0.3.59 and plain `<button>` the default. Our previous 0.3.53 pin predated that, so this
  alignment crosses onto the intended default path: no `nds-icon-button` is rendered and the
  fallback marker cannot appear. The assertions now check that the calculator button has a
  visibly rendered icon, whichever layer drew it.
- Updated dependencies [d476546]
- Updated dependencies [2fd7a31]
  - @pie-qti/item-player@0.1.23

## 0.1.22

### Patch Changes

- ba84656: Move the build toolchain to vite 8.2.1, clearing seven advisories.

  vite 8.0.10 is covered by advisories against `>=8.0.0 <=8.0.15`, and it carried
  `postcss@8.5.12` (`<=8.5.22`), `nanoid@3.3.11` (`<3.3.18`) and `rollup@4.55.1`
  (`<4.59.0`) underneath it. `bun audit` goes from 39 advisories to 32, and from 30 high to 25.

  Four packages declared a caret range that already admitted the fix and only needed the
  lockfile moved; `default-components` pinned `8.0.10` exactly, matching its house style for
  devDependencies, so that pin is now `8.2.1`.

  The last old copy was `vitest`'s own nested `vite`. vitest 4.1.10 is current and its range
  (`^6 || ^7 || ^8`) admits 8.2.1 — the lockfile was simply holding a stale nested
  resolution that neither `bun update` nor `bun install --force` re-resolves, so that entry
  was dropped and reinstalled.

  Vite is a devDependency in all three packages, so nothing about the published output
  changes; this is recorded as a patch so the advisory fix appears in the changelog.

- Updated dependencies [3aec4b3]
- Updated dependencies [ba84656]
  - @pie-qti/item-player@0.1.22

## 0.1.21

### Patch Changes

- Updated dependencies [8836ebf]
- Updated dependencies [2c00bd1]
  - @pie-qti/item-player@0.1.21

## 0.1.20

### Patch Changes

- 1cd0aff: Introduce immutable assessment-item definitions and one authoritative live `ItemSession` across
  assessment, section, custom-element, and standalone rendering. Finalize item-body and interaction
  content at their delivery boundaries, seal definition-time extension registries, and expose typed,
  immutable presentation and session contracts.

  This intentionally changes the assessment-to-section composition API, the player-element session
  property, and item-player plugin/presentation contracts. Obsolete snapshot-driven assessment
  rendering component exports are removed. Direct `Player` and managed lifecycle compatibility
  entries are removed; consumers migrate to the definition/session interface. Server scoring uses the
  DOM-free `createAssessmentItemDefinition()` export from
  `@pie-qti/item-player/server` and dispatches item-session commands. Item-player custom elements now
  publish notifications only through typed DOM events, and standard extractor implementations and
  refactor-era interaction compatibility barrels are no longer part of the package interface.

- Updated dependencies [1cd0aff]
  - @pie-qti/item-player@0.1.20

## 0.1.19

## 0.1.18

## 0.1.17

## 0.1.16

### Patch Changes

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

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15
  - @pie-qti/section-player@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
- Updated dependencies [30a4d2a]
  - @pie-qti/section-player@0.1.14
  - @pie-qti/item-player@0.1.14
  - @pie-qti/assessment-player@0.1.14
  - @pie-qti/qti-common@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.13
  - @pie-qti/item-player@0.1.13
  - @pie-qti/qti-common@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [abe0be5]
  - @pie-qti/item-player@0.1.12
  - @pie-qti/assessment-player@0.1.12
  - @pie-qti/qti-common@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.11
  - @pie-qti/item-player@0.1.11
  - @pie-qti/qti-common@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.10
  - @pie-qti/item-player@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.9
  - @pie-qti/item-player@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.8
  - @pie-qti/item-player@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.7
  - @pie-qti/item-player@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.6
  - @pie-qti/item-player@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.5
  - @pie-qti/item-player@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.4
  - @pie-qti/item-player@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.3
  - @pie-qti/item-player@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-player@0.1.2
  - @pie-qti/item-player@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/assessment-player@0.1.1
  - @pie-qti/item-player@0.1.1
