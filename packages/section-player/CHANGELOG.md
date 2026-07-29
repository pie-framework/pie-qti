# @pie-qti/section-player

## 0.1.16

### Patch Changes

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- Updated dependencies [22db6c6]
  - @pie-qti/default-components@0.1.16
  - @pie-qti/item-player@0.1.16
  - @pie-qti/qti-common@0.1.16
  - @pie-qti/i18n@0.1.16
  - @pie-qti/ims-cp-core@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.15
  - @pie-qti/i18n@0.1.15
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
- 30a4d2a: Use the upstream `pie-players` TTS highlight resolver pipeline for projected QTI content instead of patching private highlight coordinator methods. Consumers with pinned `@pie-players/*` packages must upgrade to the first fixed version that includes the resolver API.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
  - @pie-qti/item-player@0.1.14
  - @pie-qti/default-components@0.1.14
  - @pie-qti/i18n@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
  - @pie-qti/qti-common@0.1.14
