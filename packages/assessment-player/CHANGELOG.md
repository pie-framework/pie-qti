# @pie-qti/assessment-player

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
- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
- Updated dependencies [f4655e6]
  - @pie-qti/item-player@0.1.16
  - @pie-qti/assessment-toolkit@0.1.16
  - @pie-qti/default-components@0.1.16
  - @pie-qti/i18n@0.1.16
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/qti-common@0.1.16
  - @pie-qti/qti-processing@0.1.16
  - @pie-qti/section-player@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/assessment-toolkit@0.1.15
  - @pie-qti/default-components@0.1.15
  - @pie-qti/i18n@0.1.15
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15
  - @pie-qti/qti-processing@0.1.15
  - @pie-qti/section-player@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
- Updated dependencies [30a4d2a]
  - @pie-qti/assessment-toolkit@0.1.14
  - @pie-qti/section-player@0.1.14
  - @pie-qti/item-player@0.1.14
  - @pie-qti/default-components@0.1.14
  - @pie-qti/i18n@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
  - @pie-qti/qti-common@0.1.14
  - @pie-qti/qti-processing@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.13
  - @pie-qti/i18n@0.1.13
  - @pie-qti/ims-cp-core@0.1.13
  - @pie-qti/item-player@0.1.13
  - @pie-qti/qti-common@0.1.13
  - @pie-qti/qti-processing@0.1.13

## 0.1.12

### Patch Changes

- Updated dependencies [abe0be5]
  - @pie-qti/default-components@0.1.12
  - @pie-qti/item-player@0.1.12
  - @pie-qti/i18n@0.1.12
  - @pie-qti/ims-cp-core@0.1.12
  - @pie-qti/qti-common@0.1.12
  - @pie-qti/qti-processing@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.11
  - @pie-qti/i18n@0.1.11
  - @pie-qti/ims-cp-core@0.1.11
  - @pie-qti/item-player@0.1.11
  - @pie-qti/qti-common@0.1.11
  - @pie-qti/qti-processing@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.10
  - @pie-qti/i18n@0.1.10
  - @pie-qti/ims-cp-core@0.1.10
  - @pie-qti/item-player@0.1.10
  - @pie-qti/qti-processing@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.9
  - @pie-qti/i18n@0.1.9
  - @pie-qti/ims-cp-core@0.1.9
  - @pie-qti/item-player@0.1.9
  - @pie-qti/qti-processing@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.8
  - @pie-qti/i18n@0.1.8
  - @pie-qti/ims-cp-core@0.1.8
  - @pie-qti/item-player@0.1.8
  - @pie-qti/qti-processing@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.7
  - @pie-qti/i18n@0.1.7
  - @pie-qti/ims-cp-core@0.1.7
  - @pie-qti/item-player@0.1.7
  - @pie-qti/qti-processing@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.6
  - @pie-qti/i18n@0.1.6
  - @pie-qti/item-player@0.1.6
  - @pie-qti/qti-processing@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.5
  - @pie-qti/i18n@0.1.5
  - @pie-qti/item-player@0.1.5
  - @pie-qti/qti-processing@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.4
  - @pie-qti/i18n@0.1.4
  - @pie-qti/item-player@0.1.4
  - @pie-qti/qti-processing@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.3
  - @pie-qti/i18n@0.1.3
  - @pie-qti/item-player@0.1.3
  - @pie-qti/qti-processing@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/default-components@0.1.2
  - @pie-qti/i18n@0.1.2
  - @pie-qti/item-player@0.1.2
  - @pie-qti/qti-processing@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/qti-processing@0.1.1
  - @pie-qti/default-components@0.1.1
  - @pie-qti/item-player@0.1.1
