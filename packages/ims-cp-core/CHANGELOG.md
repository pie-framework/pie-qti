# @pie-qti/ims-cp-core

## 0.1.28

### Patch Changes

- @pie-qti/logger@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/logger@0.1.27

## 0.1.26

### Patch Changes

- ff00d31: pie-to-qti2 output now validates against the QTI 2.2 XSD and is scorable: generators match tag-named models through `config.elements`, place `prompt` inside the interaction, declare `SCORE` and `MAXSCORE` with response processing, export every interaction of a multi-interaction item, write rubrics as a `rubricBlock`, and re-serialize authored HTML as XML.
  
  Breaking for pie-to-qti2: the PIE item travels in a `.pie.json` sidecar listed under the item's package resource, in place of the embedded `pie:sourceModel` and `qti-metadata`, and the `pie-extension-embedder` exports are removed.
  
  Embedded sources are used only while the content beside them is unchanged: to-pie checks the sidecar's `qtiDigest` and warns `PIE_SOURCE_STALE` on a mismatch, and pie-to-qti2 regenerates QTI once a config no longer has the `configDigest` to-pie recorded. Sources written by earlier releases carry no digest and are treated as stale.
  
  to-pie keeps both the stem before an interaction and the interaction's `<prompt>`, and EBSR Part B gets the content between its two interactions. It removes QTI feedback it does not map, which rendered inside choice labels and prompts, and reports it as `QTI_FEEDBACK_DROPPED`. `validateQti` rejects XML that is not well-formed as a fatal error, also with `xsd: false`.
  
  Item `baseId` and `searchMetaData` are also written as IEEE LOM on the item's manifest resource, which to-pie reads back when no fresh sidecar is present. The manifest's `imsmd` prefix moves from `imsmd_v1p2` to the IEEE LOM namespace the QTI 2.2 packaging profile admits, and resource metadata keys other than `title`, `description` and `language` are no longer written. ims-cp-core's `parseManifest` reads resource title, description and language from prefixed LOM, in either binding, and from `general` only.
  
  The to-pie README no longer lists QTI 3.0 input, which is rejected.
- @pie-qti/logger@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/logger@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/logger@0.1.24

## 0.1.23

### Patch Changes

- @pie-qti/logger@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/logger@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/logger@0.1.21

## 0.1.20

### Patch Changes

- @pie-qti/logger@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/logger@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/logger@0.1.18

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
  - @pie-qti/logger@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/logger@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/logger@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/logger@0.1.2
