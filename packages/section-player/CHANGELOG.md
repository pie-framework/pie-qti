# @pie-qti/section-player

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
