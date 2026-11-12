# @pie-qti/assessment-toolkit

## 1.0.0-beta.5

### Patch Changes

- d7a8262: Package metadata hygiene: `@pie-qti/default-components` now declares svelte with a caret range (`^5.57.1`) like every other package instead of an exact pin that could ship two svelte runtimes into one bundle; `@pie-qti/assessment-toolkit` drops its never-imported `@pie-qti/ims-cp-core` dependency and `@pie-qti/assessment-player` drops its never-imported direct `@pie-qti/default-components` entry (it consumes default-components transitively through `section-player`, which remains declared). Both packages gain READMEs (assessment-toolkit, source-profiles) describing their role and consumers.
- 098f997: Round-3 accessibility fixes for content language, transient UI on pause, and forced colors:
  
  - **Test-level content keeps its language (WCAG 3.1.2):** the assessmentTest parser now carries
    the authored language of each `testFeedback` and `rubricBlock` (passages, instructions) as an
    optional `language` field: its own `xml:lang` (QTI 3.0 also `lang`, or its
    `qti-content-body`'s), else the enclosing test part's, section's or test's, across an
    `assessmentSectionRef` too; `xml:lang=""` declares none. `TestFeedbackItem`,
    `VisibleTestFeedback` and `AssessmentRubricBlock` gain the optional field,
    `normalizeQtiSharedContext` passes it through as `QtiSharedHtmlBlock.language`, and the section
    player's `TestFeedback` renders it as each block's `lang`/`dir` — in delivery and on the
    completion screen — so screen readers and read-aloud switch to the content's voice while the
    chrome keeps the interface locale. A passage's nested `xml:lang` is now restated as HTML `lang`
    (with `dir` where the direction changes against the passage's own language) even without SSML.
  - **Transient UI closes on a proctor pause:** the math-input dialog and glossary/catalog popups
    listen for the host's `pie-qti-close-transient-ui` event on `document` (the assessment shell
    dispatches it with `detail.reason: 'pause'`). The math dialog closes through its cancel path
    (`onCancel`, focus trap released, focus back on its opener) and a request that arrives while
    MathLive is still loading cancels it before it opens; an open popup closes as if dismissed. The
    math dialog's focus trap is re-entrancy-safe: it never re-handles the focus moves it makes, so it
    cannot recurse against another focus containment such as the pause overlay.
  - **States survive forced colors (WCAG 1.4.11/1.4.1):** in Windows High Contrast and other
    forced-colors modes the picked-up item of a reorderable list keeps a heavier system `Highlight`
    border (no layout shift), and pressed Bold/Italic toolbar toggles in the rich-text editor take
    the system selection colours. Focus outlines are unchanged.
- 8d03d05: Module boundaries (cleanup phase 3), with one fix.
  
  **Fix: a coded error keeps its code across copies of the package.** `isAssessmentPlayerError` (and `assessmentErrorDisplay`, which builds on it) used `instanceof`, which fails for an `AssessmentPlayerError` created by another copy of `@pie-qti/assessment-player`. The `<pie-qti-assessment-player>` bundle carries two copies — it compiles the shell and core from source and also imports the package's built entry — so a coded error reached the `player-error` event without its `code`. A host that loads `@pie-qti/assessment-player` beside the self-contained player-elements bundle met the same split. Every `AssessmentPlayerError` now carries a `Symbol.for('pie-qti.AssessmentPlayerError')` brand, which the guard checks; recognize coded errors with `isAssessmentPlayerError`, not `instanceof`.
  
  Without behavior changes:
  
  - `@pie-qti/section-player` exports `filterToolsForRole`, the tool filter its composition applies. `@pie-qti/assessment-toolkit`'s `normalizeQtiToolConfig` is now that filter without PNP supports: the same result, still an array.
  - `@pie-qti/item-player` exports `DEFAULT_COMPONENT_TAGS_BY_TYPE`, its default custom-element tag per interaction type (plus `catalogPopup`), and `@pie-qti/default-components` derives `registerDefaultComponents` from it. Tag names are unchanged; the registrations' debugging `description` is now generic (`Default Svelte-based component for <type>`).
  - Internal: unpublished component source is imported through one workspace alias map instead of `../../../<pkg>/src` paths; item-player's presentation code no longer imports from its Svelte component helpers; the reference backend's session key prefix (`qti_session_`) is defined once, so saved sessions resume as before.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [4e5f1a8]
- Updated dependencies [fc99dd9]
- Updated dependencies [bf483a3]
- Updated dependencies [098f997]
- Updated dependencies [ad99965]
- Updated dependencies [d6ac3bb]
- Updated dependencies [2667df1]
- Updated dependencies [20e8e52]
- Updated dependencies [b8a2862]
- Updated dependencies [2916759]
- Updated dependencies [8d03d05]
- Updated dependencies [611b971]
- Updated dependencies [fa577a0]
- Updated dependencies [07f1bc2]
- Updated dependencies [d3619a3]
- Updated dependencies
  - @pie-qti/section-player@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 15ef671: Align declared dependencies with what shipped code actually imports, enforced by a new `check:dist-dependencies` gate (added to `verify:publish:quick` and `lint:all`):
  
  - `@pie-qti/player-elements` now declares `@pie-qti/default-components`, `@pie-qti/i18n`, and `@pie-qti/section-player` as real dependencies: shipped declarations import their types, so consumer typechecks no longer depend on hoisted installs.
  - `@pie-qti/transform-core` no longer installs `@pie-qti/test-utils` (and transitively `@pie-qti/storage`) at runtime; the same cleanup moves build-only `@pie-qti/transform-core` out of `@pie-qti/to-pie` / `@pie-qti/pie-to-qti2` runtime dependencies, drops unused `@tiptap/*` runtime entries from `@pie-qti/default-components` (bundled into its bundle, now devDependencies), and removes never-imported dependencies from `@pie-qti/assessment-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/test-utils`, and `@pie-qti/section-player` (the two `@pie-players` packages that were only ever resolved transitively).
- Updated dependencies [15ef671]
- Updated dependencies [406c76c]
  - @pie-qti/section-player@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/ims-cp-core@1.0.0-beta.3
  - @pie-qti/section-player@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies [5dbabcc]
- Updated dependencies [572c3d3]
- Updated dependencies [67d94ee]
- Updated dependencies [cf99206]
  - @pie-qti/section-player@1.0.0-beta.2
  - @pie-qti/ims-cp-core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- @pie-qti/section-player@1.0.0-beta.1
  - @pie-qti/ims-cp-core@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- Updated dependencies [0d99546]
- Updated dependencies [32c08b7]
- Updated dependencies [6c209e2]
- Updated dependencies [0f93a03]
- Updated dependencies [1521a74]
- Updated dependencies [0edef83]
- Updated dependencies [70ee7a8]
- Updated dependencies [953e5d1]
  - @pie-qti/ims-cp-core@1.0.0-beta.0
  - @pie-qti/section-player@1.0.0-beta.0

## 0.1.28

### Patch Changes

- @pie-qti/section-player@0.1.28
  - @pie-qti/ims-cp-core@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/section-player@0.1.27
  - @pie-qti/ims-cp-core@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [ff00d31]
- Updated dependencies [af8ee10]
  - @pie-qti/ims-cp-core@0.1.26
  - @pie-qti/section-player@0.1.26

## 0.1.25

### Patch Changes

- Updated dependencies
  - @pie-qti/section-player@0.1.25
  - @pie-qti/ims-cp-core@0.1.25

## 0.1.24

### Patch Changes

- Updated dependencies
  - @pie-qti/section-player@0.1.24
  - @pie-qti/ims-cp-core@0.1.24

## 0.1.23

### Patch Changes

- Updated dependencies [4df35b3]
- Updated dependencies [4341302]
  - @pie-qti/section-player@0.1.23
  - @pie-qti/ims-cp-core@0.1.23

## 0.1.22

### Patch Changes

- Updated dependencies [3aec4b3]
  - @pie-qti/section-player@0.1.22
  - @pie-qti/ims-cp-core@0.1.22

## 0.1.21

### Patch Changes

- Updated dependencies [8836ebf]
  - @pie-qti/section-player@0.1.21
  - @pie-qti/ims-cp-core@0.1.21

## 0.1.20

### Patch Changes

- Updated dependencies [1cd0aff]
  - @pie-qti/section-player@0.1.20
  - @pie-qti/ims-cp-core@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/section-player@0.1.19
- @pie-qti/ims-cp-core@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/section-player@0.1.18
- @pie-qti/ims-cp-core@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [76311bb]
  - @pie-qti/ims-cp-core@0.1.17
  - @pie-qti/section-player@0.1.17

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

- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/section-player@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/section-player@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
- Updated dependencies [30a4d2a]
  - @pie-qti/section-player@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
