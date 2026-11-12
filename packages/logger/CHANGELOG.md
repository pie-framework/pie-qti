# @pie-qti/logger

## 1.0.0-beta.5

### Patch Changes

- 1f1d8f0: The universal `Logger` interface is now coherent: all four levels (`debug`, `info`, `warn`, `error`) are required, matching the documented contract ("compatible with the browser console object") and what every in-repo implementation already provides. Previously `debug`/`warn` were required while `info`/`error` were optional, so an implementation with no error output typechecked as a `Logger` and every consumer had to defensive-call `logger.error?.()`. The browser `Logger.child()` also composes prefixes from raw names now, so `createLogger('Parent').child('Child')` logs `[Parent:Child] test` as its documentation always promised (it previously logged `[Parent]:Child test`).
  
  Breaking: `noopLogger` and `consoleLogger` were removed from `@pie-qti/logger`. Both had zero consumers anywhere in the repo (the server entry's `ConsoleLogger` class is a different symbol and is unaffected); for a no-op logger use the server entry's `SilentLogger` or your own four-method stub. Implementations of the `Logger` interface that omitted `info` or `error` must now provide them.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 1.0.0-beta.4

No changes in this release.

## 1.0.0-beta.3

No changes in this release.

## 1.0.0-beta.2

No changes in this release.

## 1.0.0-beta.1

No changes in this release.

## 1.0.0-beta.0

No changes in this release.

## 0.1.28

No changes in this release.

## 0.1.27

No changes in this release.

## 0.1.26

No changes in this release.

## 0.1.25

No changes in this release.

## 0.1.24

## 0.1.23

## 0.1.22

## 0.1.21

## 0.1.20

## 0.1.19

## 0.1.18

## 0.1.17

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

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
