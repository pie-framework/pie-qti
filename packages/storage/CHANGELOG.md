# @pie-qti/storage

## 0.1.20

### Patch Changes

- @pie-qti/transform-types@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/transform-types@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/transform-types@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [9b1e118]
  - @pie-qti/transform-types@0.1.17

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

- 9c6d374: Update `adm-zip` and `uuid` to versions without published advisories.

  - `@pie-qti/storage`: `adm-zip` `^0.5.16` → `^0.6.0` (CVE-2026-39244, high — a crafted
    ZIP can trigger a 4 GB memory allocation). This is the one with real exposure here:
    `storage/src/zip-extractor.ts` extracts untrusted QTI content packages. Its
    pre-extraction limits (100 MB compressed, 250 MB uncompressed, 1000 entries, ratio 200)
    check sizes advertised in the central directory, so they reduce but do not necessarily
    prevent an allocation made while the archive itself is parsed.
  - `@pie-qti/to-pie`, `@pie-qti/pie-to-qti2`: `uuid` `^10.0.0` → `^11.1.1`
    (CVE-2026-41907, moderate).
  - `@pie-qti/demo-vendor-extensions`: `uuid` `^11.0.5` → `^11.1.1`. This resolved to
    `uuid@11.1.0`, which is also below the patched version, and was not covered by an
    advisory alert.

  The `uuid` advisory concerns a missing buffer bounds check in `v3`/`v5`/`v6` when a `buf`
  argument is supplied. Every call site in this repository uses `v4()` with no arguments,
  so it was not reachable; these bumps clear the advisory rather than fix an exploitable
  path.

  Also drops `@types/uuid` from `to-pie` and `pie-to-qti2`. It is a deprecated stub
  ("uuid provides its own type definitions, so you do not need this installed") and was
  pinned at `^10.0.0`, one major behind the runtime package whose bundled types it shadowed.

  Both dependencies are external to the published bundles — consumers resolve them from
  their own `node_modules` — so the updated ranges reach consumers directly.

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- Updated dependencies [5a4e39a]
  - @pie-qti/transform-types@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/transform-types@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/transform-types@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/transform-types@0.1.2
