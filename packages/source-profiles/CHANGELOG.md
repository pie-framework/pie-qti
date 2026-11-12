# @pie-qti/source-profiles

## 1.0.0-beta.5

### Patch Changes

- 88f849c: The transformation packages join the 1.0 beta line: every publishable `@pie-qti/*` package now releases at one version, so these move from `0.2.x` to `1.0.0-beta.5` and publish under the `beta` dist-tag with the players. Hosts that pin them exactly need the new version; a `^0.2` range does not pick it up.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af63915]
- Updated dependencies [88f849c]
- Updated dependencies [93df941]
- Updated dependencies
- Updated dependencies [684738a]
  - @pie-qti/transform-types@1.0.0-beta.5

## 0.2.1

### Patch Changes

- Updated dependencies [29210b4]
  - @pie-qti/transform-types@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/transform-types@0.2.0

## 0.1.31

### Patch Changes

- @pie-qti/transform-types@0.1.31

## 0.1.30

### Patch Changes

- @pie-qti/transform-types@0.1.30

## 0.1.29

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
