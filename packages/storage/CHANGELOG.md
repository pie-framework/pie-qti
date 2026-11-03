# @pie-qti/storage

## 1.0.0-beta.4

### Patch Changes

- fb2b4e2: Converge the zip-extraction safety policy into `@pie-qti/ims-cp-core` (new `./archive-limits` subpath and root exports: `ArchiveExtractionLimits`, `DEFAULT_ARCHIVE_EXTRACTION_LIMITS`, `resolveArchiveLimit`, `exceedsCompressionRatio`). The identical guardrail constants (100 MB compressed / 250 MB uncompressed / 1000 entries / compression-ratio 200), limit validation, and ratio math were copy-pasted across the jszip (browser), unzipper (node), and adm-zip (storage) engines and could drift independently; all three now share the one authority. Engine-specific checks (per-entry size sanity, symlink guards, per-file size limits) remain with each engine. `@pie-qti/storage` gains a dependency on `@pie-qti/ims-cp-core` for the shared policy.
- c03fb89: Correct the package's bundler contract and document its environment. The root entry registers the `filesystem`/`s3`/`database` backends into the shared registry at import time; `sideEffects` now declares this (`["./dist/index.js"]`) instead of claiming the package is side-effect free, so bundlers no longer license dropping the registration when the root entry is used. A README documents that the package is Node-only, what each entry targets, the optional AWS peer dependencies, and clarifies that `./session-storage` is a server-side session path manager (browser sessionStorage backends live in `@pie-qti/ims-cp-browser`), that the `database` backend is a throwing stub, and removes a leftover `s3-backend.ts.patch` from `src/`.
- Updated dependencies [fb2b4e2]
- Updated dependencies [29210b4]
  - @pie-qti/ims-cp-core@1.0.0-beta.4
  - @pie-qti/transform-types@0.2.1

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/transform-types@0.2.0

## 1.0.0-beta.2

### Patch Changes

- @pie-qti/transform-types@0.1.31

## 1.0.0-beta.1

### Patch Changes

- @pie-qti/transform-types@0.1.30

## 1.0.0-beta.0

### Patch Changes

- @pie-qti/transform-types@0.1.29

## 0.1.28

### Patch Changes

- @pie-qti/transform-types@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/transform-types@0.1.27

## 0.1.26

### Patch Changes

- cd85c07: Require `adm-zip` 0.6.1 and `image-size` 2.0.4, which fall outside their published security advisories.
- Updated dependencies [ff00d31]
  - @pie-qti/transform-types@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/transform-types@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/transform-types@0.1.24

## 0.1.23

### Patch Changes

- @pie-qti/transform-types@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/transform-types@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/transform-types@0.1.21

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
