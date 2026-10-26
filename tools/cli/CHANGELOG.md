# @pie-qti/transform-cli

## 0.2.0

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/transform-types@0.2.0
  - @pie-qti/to-pie@0.2.0
  - @pie-qti/transform-core@0.2.0
  - @pie-qti/ims-cp-node@1.0.0-beta.3
  - @pie-qti/logger@1.0.0-beta.3

## 0.1.31

### Patch Changes

- @pie-qti/to-pie@0.1.31
  - @pie-qti/ims-cp-node@1.0.0-beta.2
  - @pie-qti/logger@1.0.0-beta.2
  - @pie-qti/transform-core@0.1.31
  - @pie-qti/transform-types@0.1.31

## 0.1.30

### Patch Changes

- 66f5281: Dependency updates: `jszip` 3.10.2 in `@pie-qti/ims-cp-browser`, `@tiptap/starter-kit` 3.32.0 in `@pie-qti/default-components`, and `@oclif/core` 5.1.8 in `@pie-qti/transform-cli`. No API changes; published dependency ranges move with the bumps.
- @pie-qti/ims-cp-node@1.0.0-beta.1
  - @pie-qti/logger@1.0.0-beta.1
  - @pie-qti/transform-core@0.1.30
  - @pie-qti/to-pie@0.1.30
  - @pie-qti/transform-types@0.1.30

## 0.1.29

### Patch Changes

- Updated dependencies [19f62bf]
  - @pie-qti/to-pie@0.1.29
  - @pie-qti/ims-cp-node@1.0.0-beta.0
  - @pie-qti/logger@1.0.0-beta.0
  - @pie-qti/transform-core@0.1.29
  - @pie-qti/transform-types@0.1.29

## 0.1.28

### Patch Changes

- 73ec447: The CLI moves to `@oclif/core` 5 and declares the Node.js 22 floor oclif already required; Node.js 20 cannot run it.
- Updated dependencies [8fd28e3]
  - @pie-qti/to-pie@0.1.28
  - @pie-qti/transform-core@0.1.28
  - @pie-qti/ims-cp-node@0.1.28
  - @pie-qti/logger@0.1.28
  - @pie-qti/transform-types@0.1.28

## 0.1.27

### Patch Changes

- Updated dependencies [498b1e2]
  - @pie-qti/to-pie@0.1.27
  - @pie-qti/transform-core@0.1.27
  - @pie-qti/ims-cp-node@0.1.27
  - @pie-qti/logger@0.1.27
  - @pie-qti/transform-types@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [ff00d31]
- Updated dependencies [af8ee10]
- Updated dependencies [cd85c07]
- Updated dependencies [34c0034]
- Updated dependencies [0307016]
- Updated dependencies [9e96848]
- Updated dependencies [5627ce1]
  - @pie-qti/to-pie@0.1.26
  - @pie-qti/transform-types@0.1.26
  - @pie-qti/transform-core@0.1.26
  - @pie-qti/ims-cp-node@0.1.26
  - @pie-qti/logger@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/transform-core@0.1.25
  - @pie-qti/ims-cp-node@0.1.25
  - @pie-qti/logger@0.1.25
  - @pie-qti/to-pie@0.1.25
  - @pie-qti/transform-types@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/transform-core@0.1.24
  - @pie-qti/ims-cp-node@0.1.24
  - @pie-qti/logger@0.1.24
  - @pie-qti/to-pie@0.1.24
  - @pie-qti/transform-types@0.1.24

## 0.1.23

### Patch Changes

- Updated dependencies [20bcefa]
  - @pie-qti/to-pie@0.1.23
  - @pie-qti/transform-core@0.1.23
  - @pie-qti/ims-cp-node@0.1.23
  - @pie-qti/logger@0.1.23
  - @pie-qti/transform-types@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/ims-cp-node@0.1.22
- @pie-qti/logger@0.1.22
- @pie-qti/to-pie@0.1.22
- @pie-qti/transform-core@0.1.22
- @pie-qti/transform-types@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/ims-cp-node@0.1.21
- @pie-qti/logger@0.1.21
- @pie-qti/to-pie@0.1.21
- @pie-qti/transform-core@0.1.21
- @pie-qti/transform-types@0.1.21

## 0.1.20

### Patch Changes

- @pie-qti/ims-cp-node@0.1.20
- @pie-qti/logger@0.1.20
- @pie-qti/to-pie@0.1.20
- @pie-qti/transform-core@0.1.20
- @pie-qti/transform-types@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/ims-cp-node@0.1.19
- @pie-qti/logger@0.1.19
- @pie-qti/to-pie@0.1.19
- @pie-qti/transform-core@0.1.19
- @pie-qti/transform-types@0.1.19

## 0.1.18

### Patch Changes

- Updated dependencies [bd51a94]
  - @pie-qti/ims-cp-node@0.1.18
  - @pie-qti/to-pie@0.1.18
  - @pie-qti/logger@0.1.18
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
  - @pie-qti/to-pie@0.1.17
  - @pie-qti/transform-types@0.1.17
  - @pie-qti/transform-core@0.1.17
  - @pie-qti/ims-cp-node@0.1.17
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

- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [9c6d374]
- Updated dependencies [22db6c6]
  - @pie-qti/ims-cp-node@0.1.16
  - @pie-qti/logger@0.1.16
  - @pie-qti/to-pie@0.1.16
  - @pie-qti/transform-core@0.1.16
  - @pie-qti/transform-types@0.1.16

## 0.1.15

### Patch Changes

- Updated dependencies
  - @pie-qti/ims-cp-node@0.1.15
  - @pie-qti/logger@0.1.15
  - @pie-qti/to-pie@0.1.15
  - @pie-qti/transform-core@0.1.15
  - @pie-qti/transform-types@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/ims-cp-node@0.1.14
- @pie-qti/logger@0.1.14
- @pie-qti/to-pie@0.1.14
- @pie-qti/transform-core@0.1.14
- @pie-qti/transform-types@0.1.14

## 0.1.13

### Patch Changes

- Updated dependencies
  - @pie-qti/ims-cp-node@0.1.13
  - @pie-qti/logger@0.1.13
  - @pie-qti/to-pie@0.1.13
  - @pie-qti/transform-core@0.1.13
  - @pie-qti/transform-types@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/ims-cp-node@0.1.12
- @pie-qti/logger@0.1.12
- @pie-qti/to-pie@0.1.12
- @pie-qti/transform-core@0.1.12
- @pie-qti/transform-types@0.1.12

## 0.1.11

### Patch Changes

- Updated dependencies
  - @pie-qti/ims-cp-node@0.1.11
  - @pie-qti/logger@0.1.11
  - @pie-qti/to-pie@0.1.11
  - @pie-qti/transform-core@0.1.11
  - @pie-qti/transform-types@0.1.11

## 0.1.10

### Patch Changes

- Updated dependencies
  - @pie-qti/logger@0.1.10
  - @pie-qti/to-pie@0.1.10
  - @pie-qti/transform-core@0.1.10
  - @pie-qti/transform-types@0.1.10

## 0.1.9

### Patch Changes

- Updated dependencies
  - @pie-qti/logger@0.1.9
  - @pie-qti/to-pie@0.1.9
  - @pie-qti/transform-core@0.1.9
  - @pie-qti/transform-types@0.1.9

## 0.1.8

### Patch Changes

- Updated dependencies
  - @pie-qti/logger@0.1.8
  - @pie-qti/to-pie@0.1.8
  - @pie-qti/transform-core@0.1.8
  - @pie-qti/transform-types@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies
  - @pie-qti/logger@0.1.7
  - @pie-qti/to-pie@0.1.7
  - @pie-qti/transform-core@0.1.7
  - @pie-qti/transform-types@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies
  - @pie-qti/logger@0.1.6
  - @pie-qti/to-pie@0.1.6
  - @pie-qti/transform-core@0.1.6
  - @pie-qti/transform-types@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies
  - @pie-qti/logger@0.1.5
  - @pie-qti/to-pie@0.1.5
  - @pie-qti/transform-core@0.1.5
  - @pie-qti/transform-types@0.1.5

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/to-pie@0.1.1
  - @pie-qti/transform-core@0.1.1
  - @pie-qti/transform-types@0.1.1
