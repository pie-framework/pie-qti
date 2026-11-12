# @pie-qti/test-utils

## 1.0.0-beta.5

### Patch Changes

- 62bf5bc: `@pie-qti/storage` has been removed from the repository and will not receive further releases. It had no consumers anywhere in the workspace (its only graph edge was an unused entry in `@pie-qti/test-utils`'s dependencies, now removed), shipped a bundler-hostile `sideEffects: false` flag contradicting its top-level registry side effects, and its S3 backend used dynamic-import escapes that nothing exercised. Existing npm installs of `@pie-qti/storage` keep working from their lockfiles; hosts needing the interfaces can find them in source history. `@pie-qti/test-utils` no longer declares a dependency on it — its mocks implement the `@pie-qti/transform-types` interfaces directly, as they always did.
- 77651d4: **Breaking: remove 17 unused exports from `@pie-qti/test-utils`** (beta prerelease). Repo-wide verification found zero consumers outside the package for the entire fixture-loader surface (`loadFixture`, `loadSharedFixture`, `loadFixtureBuffer`, `loadSharedFixtureBuffer`), six assertion helpers (`expectLosslessRoundTrip`, `expectValidChoiceInteraction`, `expectTransformError`, `expectMetadata`, `expectArrayContains`), the `MockPluginOptions` type re-export, the `createRejectingPlugin`/`createFailingPlugin` factories, the `CaptureLogger` and `ConsoleLogger` re-exports, and the `parseQtiItem`, `parseElement`, `createOutcomeDeclaration` QTI builders. The package's own tests and README were the only things keeping this surface green, and the README additionally documented a `createTestEngine` export that never existed. Tests that need these helpers already keep local copies where they are used (`to-pie/tests/test-utils.ts`, `item-player/tests/extraction/test-utils.ts`). Also removed the never-imported shared `fixtures/` directory. The remaining surface — `MockStorageBackend`, `MockTransformPlugin`, `createMockPlugin`, `SilentLogger`, `createQtiWrapper`, `createResponseDeclaration`, `createChoiceInteraction`, `expectValidPieModel`, `expectSuccessfulTransform` — is unchanged in behavior. `MockPluginOptions` remains exported from the plugin module (it is the `MockTransformPlugin` constructor's parameter type) but is no longer re-exported from the package entry.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Stop installing `node-html-parser` for consumers: the package's dist never imports it (only its own test suite does), so it moves from dependencies to devDependencies and no longer lands in `npm install @pie-qti/test-utils` trees.
- Updated dependencies [af63915]
- Updated dependencies [1f1d8f0]
- Updated dependencies [88f849c]
- Updated dependencies [93df941]
- Updated dependencies
- Updated dependencies [684738a]
  - @pie-qti/transform-types@1.0.0-beta.5
  - @pie-qti/logger@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 15ef671: Align declared dependencies with what shipped code actually imports, enforced by a new `check:dist-dependencies` gate (added to `verify:publish:quick` and `lint:all`):
  
  - `@pie-qti/player-elements` now declares `@pie-qti/default-components`, `@pie-qti/i18n`, and `@pie-qti/section-player` as real dependencies: shipped declarations import their types, so consumer typechecks no longer depend on hoisted installs.
  - `@pie-qti/transform-core` no longer installs `@pie-qti/test-utils` (and transitively `@pie-qti/storage`) at runtime; the same cleanup moves build-only `@pie-qti/transform-core` out of `@pie-qti/to-pie` / `@pie-qti/pie-to-qti2` runtime dependencies, drops unused `@tiptap/*` runtime entries from `@pie-qti/default-components` (bundled into its bundle, now devDependencies), and removes never-imported dependencies from `@pie-qti/assessment-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/test-utils`, and `@pie-qti/section-player` (the two `@pie-players` packages that were only ever resolved transitively).
- Updated dependencies [29210b4]
  - @pie-qti/transform-types@0.2.1
  - @pie-qti/logger@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/transform-types@0.2.0
  - @pie-qti/storage@1.0.0-beta.3
  - @pie-qti/logger@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- @pie-qti/logger@1.0.0-beta.2
  - @pie-qti/storage@1.0.0-beta.2
  - @pie-qti/transform-types@0.1.31

## 1.0.0-beta.1

### Patch Changes

- @pie-qti/logger@1.0.0-beta.1
  - @pie-qti/storage@1.0.0-beta.1
  - @pie-qti/transform-types@0.1.30

## 1.0.0-beta.0

### Patch Changes

- @pie-qti/logger@1.0.0-beta.0
  - @pie-qti/storage@1.0.0-beta.0
  - @pie-qti/transform-types@0.1.29

## 0.1.28

### Patch Changes

- @pie-qti/transform-core@0.1.28
  - @pie-qti/logger@0.1.28
  - @pie-qti/storage@0.1.28
  - @pie-qti/transform-types@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/transform-core@0.1.27
  - @pie-qti/logger@0.1.27
  - @pie-qti/storage@0.1.27
  - @pie-qti/transform-types@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [ff00d31]
- Updated dependencies [cd85c07]
  - @pie-qti/transform-types@0.1.26
  - @pie-qti/storage@0.1.26
  - @pie-qti/transform-core@0.1.26
  - @pie-qti/logger@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/transform-core@0.1.25
  - @pie-qti/logger@0.1.25
  - @pie-qti/storage@0.1.25
  - @pie-qti/transform-types@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/transform-core@0.1.24
  - @pie-qti/logger@0.1.24
  - @pie-qti/storage@0.1.24
  - @pie-qti/transform-types@0.1.24

## 0.1.23

### Patch Changes

- @pie-qti/transform-core@0.1.23
  - @pie-qti/logger@0.1.23
  - @pie-qti/storage@0.1.23
  - @pie-qti/transform-types@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/logger@0.1.22
- @pie-qti/storage@0.1.22
- @pie-qti/transform-core@0.1.22
- @pie-qti/transform-types@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/logger@0.1.21
- @pie-qti/storage@0.1.21
- @pie-qti/transform-core@0.1.21
- @pie-qti/transform-types@0.1.21

## 0.1.20

### Patch Changes

- @pie-qti/logger@0.1.20
- @pie-qti/storage@0.1.20
- @pie-qti/transform-core@0.1.20
- @pie-qti/transform-types@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/logger@0.1.19
- @pie-qti/storage@0.1.19
- @pie-qti/transform-core@0.1.19
- @pie-qti/transform-types@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/logger@0.1.18
- @pie-qti/storage@0.1.18
- @pie-qti/transform-core@0.1.18
- @pie-qti/transform-types@0.1.18

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
  - @pie-qti/transform-types@0.1.17
  - @pie-qti/transform-core@0.1.17
  - @pie-qti/storage@0.1.17
  - @pie-qti/logger@0.1.17

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
- Updated dependencies [9c6d374]
- Updated dependencies [22db6c6]
  - @pie-qti/logger@0.1.16
  - @pie-qti/storage@0.1.16
  - @pie-qti/transform-core@0.1.16
  - @pie-qti/transform-types@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.15
  - @pie-qti/storage@0.1.15
  - @pie-qti/transform-core@0.1.15
  - @pie-qti/transform-types@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/logger@0.1.14
- @pie-qti/storage@0.1.14
- @pie-qti/transform-core@0.1.14
- @pie-qti/transform-types@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.13
  - @pie-qti/storage@0.1.13
  - @pie-qti/transform-core@0.1.13
  - @pie-qti/transform-types@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/logger@0.1.12
- @pie-qti/storage@0.1.12
- @pie-qti/transform-core@0.1.12
- @pie-qti/transform-types@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.11
  - @pie-qti/storage@0.1.11
  - @pie-qti/transform-core@0.1.11
  - @pie-qti/transform-types@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.10
  - @pie-qti/storage@0.1.10
  - @pie-qti/transform-core@0.1.10
  - @pie-qti/transform-types@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.9
  - @pie-qti/storage@0.1.9
  - @pie-qti/transform-core@0.1.9
  - @pie-qti/transform-types@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.8
  - @pie-qti/storage@0.1.8
  - @pie-qti/transform-core@0.1.8
  - @pie-qti/transform-types@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.7
  - @pie-qti/storage@0.1.7
  - @pie-qti/transform-core@0.1.7
  - @pie-qti/transform-types@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.6
  - @pie-qti/storage@0.1.6
  - @pie-qti/transform-core@0.1.6
  - @pie-qti/transform-types@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.5
  - @pie-qti/storage@0.1.5
  - @pie-qti/transform-core@0.1.5
  - @pie-qti/transform-types@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.4
  - @pie-qti/storage@0.1.4
  - @pie-qti/transform-core@0.1.4
  - @pie-qti/transform-types@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.3
  - @pie-qti/storage@0.1.3
  - @pie-qti/transform-core@0.1.3
  - @pie-qti/transform-types@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.2
  - @pie-qti/storage@0.1.2
  - @pie-qti/transform-core@0.1.2
  - @pie-qti/transform-types@0.1.2
