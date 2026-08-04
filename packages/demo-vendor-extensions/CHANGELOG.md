# @pie-qti/demo-vendor-extensions

## 0.1.17

### Patch Changes

- 76311bb: Update the third-party runtime dependencies that ship to consumers.

  **`node-html-parser` moves from `^6.1.13`/`^7.0.x` to `^9.0.1`.** This affects
  `transform-core`, `to-pie`, `item-player`, `test-utils`, `demo-vendor-extensions`,
  `assessment-player`, `ims-cp-core`, `pie-to-qti2` and `transform-cli`.

  Worth knowing if you resolve `node-html-parser` yourself: five of those packages name it in
  their published type declarations rather than wrapping it — `transform-core`, `to-pie`,
  `item-player`, `test-utils` and `demo-vendor-extensions` all emit
  `import type { HTMLElement } from 'node-html-parser'` into their `.d.ts`, so the parser's
  own types are part of their public surface and this jump crosses three majors.

  If you exchange parsed elements with those packages, move to `9.x`. Pinning an older major
  leaves two copies of `HTMLElement` in the type graph, and structurally incompatible ones
  will not assign to each other. Consumers that only pass QTI strings in and take converted
  output back out are unaffected.

  **`katex` moves from `^0.16.27` to `^0.18.1`** in `typeset-katex`, **`mathlive` from
  `^0.108.2` to `^0.110.0`** in `item-player` and `default-components`, and
  **`@tiptap/core` from `^3.15.3` to `^3.29.2`** in `default-components`. None of these
  appear in published declarations. Applications that load their own copy of KaTeX or
  MathLive alongside ours should still check the pairing, since both ship stylesheets and
  fonts.

  All publishable packages release as one fixed-version set, so the whole set moves together.

- Updated dependencies [9b1e118]
- Updated dependencies [76311bb]
  - @pie-qti/to-pie@0.1.17
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

- Updated dependencies [5a4e39a]
- Updated dependencies [9c6d374]
  - @pie-qti/to-pie@0.1.16
  - @pie-qti/transform-types@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.15
  - @pie-qti/transform-types@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/to-pie@0.1.14
- @pie-qti/transform-types@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.13
  - @pie-qti/transform-types@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/to-pie@0.1.12
- @pie-qti/transform-types@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.11
  - @pie-qti/transform-types@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.10
  - @pie-qti/transform-types@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.9
  - @pie-qti/transform-types@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.8
  - @pie-qti/transform-types@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.7
  - @pie-qti/transform-types@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.6
  - @pie-qti/transform-types@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.5
  - @pie-qti/transform-types@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.4
  - @pie-qti/transform-types@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.3
  - @pie-qti/transform-types@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/to-pie@0.1.2
  - @pie-qti/transform-types@0.1.2
