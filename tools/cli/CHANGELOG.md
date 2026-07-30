# @pie-qti/transform-cli

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
