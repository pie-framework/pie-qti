# @pie-qti/ims-cp-browser

## 1.0.0-beta.1

### Patch Changes

- 66f5281: Dependency updates: `jszip` 3.10.2 in `@pie-qti/ims-cp-browser`, `@tiptap/starter-kit` 3.32.0 in `@pie-qti/default-components`, and `@oclif/core` 5.1.8 in `@pie-qti/transform-cli`. No API changes; published dependency ranges move with the bumps.
- @pie-qti/ims-cp-core@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- 953e5d1: Shared catalog files from the content package manifest (G-15, QTI 3.0 §6.3): `loadResolvedManifest` surfaces resources of type `imsqti_catalog_xmlv3p0` as `sharedCatalogs`; `createResolvedItemDeliveryContext` accepts `packageCatalogSources` and the reference backend adapter threads a host-supplied list (`parseAssessmentTestXml({ sharedCatalogs })`, exposed as `QtiAssessmentPlayerConfig.sharedCatalogs`) into every item's delivery context. The item player merges package-scope entries at the bottom, so an item-level `qti-catalog-info` wins a shared identifier and a shared file backs items that declare none.
- Updated dependencies [0d99546]
- Updated dependencies [0edef83]
- Updated dependencies [953e5d1]
  - @pie-qti/ims-cp-core@1.0.0-beta.0

## 0.1.28

### Patch Changes

- @pie-qti/ims-cp-core@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/ims-cp-core@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [ff00d31]
  - @pie-qti/ims-cp-core@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/ims-cp-core@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/ims-cp-core@0.1.24

## 0.1.23

### Patch Changes

- @pie-qti/ims-cp-core@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/ims-cp-core@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/ims-cp-core@0.1.21

## 0.1.20

### Patch Changes

- @pie-qti/ims-cp-core@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/ims-cp-core@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/ims-cp-core@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [76311bb]
  - @pie-qti/ims-cp-core@0.1.17

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
- Updated dependencies [5a4e39a]
  - @pie-qti/ims-cp-core@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/ims-cp-core@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/ims-cp-core@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.2
