# @pie-qti/qti-common

## 0.1.24

### Patch Changes

- 5c8a8e8: Route touch-generated drag events to the actual drop target inside nested open shadow roots, use the source element's owner document, and clear active drag state when the action is destroyed.
- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.

## 0.1.23

## 0.1.22

## 0.1.21

## 0.1.20

### Patch Changes

- 1cd0aff: Introduce immutable assessment-item definitions and one authoritative live `ItemSession` across
  assessment, section, custom-element, and standalone rendering. Finalize item-body and interaction
  content at their delivery boundaries, seal definition-time extension registries, and expose typed,
  immutable presentation and session contracts.

  This intentionally changes the assessment-to-section composition API, the player-element session
  property, and item-player plugin/presentation contracts. Obsolete snapshot-driven assessment
  rendering component exports are removed. Direct `Player` and managed lifecycle compatibility
  entries are removed; consumers migrate to the definition/session interface. Server scoring uses the
  DOM-free `createAssessmentItemDefinition()` export from
  `@pie-qti/item-player/server` and dispatches item-session commands. Item-player custom elements now
  publish notifications only through typed DOM events, and standard extractor implementations and
  refactor-era interaction compatibility barrels are no longer part of the package interface.

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

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.

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
