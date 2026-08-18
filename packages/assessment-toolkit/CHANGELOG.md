# @pie-qti/assessment-toolkit

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
