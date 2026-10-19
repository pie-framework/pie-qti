# @pie-qti/qti-common

## 1.0.0-beta.1

No changes in this release.

## 1.0.0-beta.0

### Patch Changes

- 32c08b7: Content language follows `xml:lang`. `prepareContentMarkup` restates it as `lang`; the item body takes its `lang` from the item, exposed as `Player.getContentLanguage()`, and glossary lookups pass it. The section player sets the toolbar and TTS language from it and picks a Polly voice for that language unless the host configures `defaultVoice`, which no longer defaults to Joanna; shared HTML blocks take an optional `language`.
- 0f93a03: Read-aloud markup reaches delivery. `prepareContentMarkup` moves from to-pie into `@pie-qti/qti-common/accessibility` and reads QTI 3 names; the item player renders SSML docked as catalog idrefs and `data-qti-suppress-tts` as `data-tts-suppress`, and the section player registers the SSML as `spoken` catalogs and projects QTI 3 interactions without suppressed content.
- a7c714e: `feedbackInline` resolves in either QTI spelling, nested and by membership in a container outcome, in the item body, choice text, rubric blocks and modal feedback; `qti-common` exports the shared visibility rule as `isShownByIdentifier`.

## 0.1.28

### Patch Changes

- 6af3354: The QTI 3 element map now covers every `qti-*` element of the QTI 3.0 schema, including test structure, shared stimuli and companion materials, so `toNative` and `isQti3Element` answer for them; six names the schema does not declare are removed.
- 8fd28e3: Add a QTI 3.0 export: `targetVersion: '3.0'` on `PieToQtiPlugin` writes QTI 3.0 items, stimuli, tests and content packages, with catalogs as `qti-catalog-info`. `@pie-qti/qti-common` gains `convertQti2ToQti3` and `writeQtiCatalogInfo`; `@pie-qti/to-pie` reads the export back, unwrapping `qti-content-body` and resolving a stimulus reference by its PIE passage id.

## 0.1.27

### Patch Changes

- 498b1e2: `@pie-qti/qti-common/accessibility` maps APIP 1.0 access elements to and from QTI 3 support cards: `readApipAccessElements` reads them with their content links, and `writeApipAccessibility` writes cards as `apip:apipAccessibility`, reporting the supports APIP has no element for.

## 0.1.26

### Patch Changes

- 5627ce1: to-pie converts QTI 3.0 items, stimuli and tests: `normalizeQti3ToQti2` renames them into the QTI 2.2 vocabulary at the entry point, a vendor transformer still sees the authored document, and a portable custom interaction stays rejected. QTI 3.0 catalogs, APIP access elements and inline SSML become PIE accessibility catalogs keyed by `data-catalog-idref`, companion materials land in `metadata.companionMaterials`, and anything not carried warns `QTI_ACCESSIBILITY_NOT_CARRIED`. Passages convert once per stimulus document through `convertQtiPassageDocument` and come out of the package transform beside the items, prompts keep only the stem, and an unresolvable passage reference warns `QTI_PASSAGE_UNRESOLVED`. `PieAssessment` drops `accessibilityCatalogs` and `stimulusRefs` along with the `StimulusRef` type, and its sections carry `rubricBlocks` in the PIE players' `RubricBlock` shape in place of `rubricRefs`. qti-common exports `QTI3_ATTRIBUTE_TO_QTI2` and `QTI2_PROMPT_BEARING_INTERACTIONS`.

## 0.1.25

No changes in this release.

## 0.1.24

### Patch Changes

- 5c8a8e8: Route touch-generated drag events to the actual drop target inside nested open shadow roots, use the source element's owner document, and clear active drag state when the action is destroyed.
- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.

## 0.1.23

## 0.1.22

## 0.1.21

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

## 0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
