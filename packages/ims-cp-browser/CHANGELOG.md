# @pie-qti/ims-cp-browser

## 1.0.0-beta.5

### Patch Changes

- e7188e4: Harden and unify the archive-safety boundary that was duplicated per platform:
  
  - **Shared limit rules**: `resolveLimit` and `exceedsCompressionRatio` (entry-count, size, and compression-bomb caps for untrusted packages) now live once in `@pie-qti/ims-cp-core`; the Node and browser packages import them instead of carrying drifted copies.
  - **Node manifest hrefs fail closed**: `loadResolvedManifest` previously normalized hostile hrefs — an absolute href like `/etc/passwd` was silently rewritten to `etc/passwd` inside the package. Absolute, protocol-bearing, or encoded-traversal `href`/`file`/`xml:base` values are now rejected with an error, matching the browser's grammar (which drops them). Escape attempts keep throwing.
  - **Browser persistence is opt-in**: `openPackage` no longer saves every opened package to `sessionStorage` by default (a quota-bound, text-only snapshot that dropped all binary files on restore — large packages failed to open at all). Pass `persist: true` to keep the old behavior.
- 93df941: Packaging and back-compat shim removal (legacy audit PR 5, `docs/plans/legacy-audit-2026-11.md` rows A5, A6, A7). No QTI-observable behaviour changes for current-format content.
  
  **Breaking: removed deprecated image-path helper** (beta prerelease; migrate before upgrading):
  
  - `@pie-qti/ims-cp-browser` no longer exports `tryResolveImagePath`. It had been `@deprecated` since path resolution moved to `@pie-qti/ims-cp-core` and had no callers in the repo. Resolve package image references with `buildPackageFileIndex` and `resolvePackageReference` from `@pie-qti/ims-cp-core` (as `resolveImagesInXml` already does); the documented lenient path-resolution heuristics are unchanged.
  
  **Breaking: removed the historical vendor-extension type path** (beta prerelease; migrate before upgrading):
  
  - `@pie-qti/to-pie` no longer re-exports `VendorInfo`, `VendorDetector`, `VendorTransformer`, `ResolvedAsset`, `AssetResolver`, `VendorClasses`, `CssClassExtractor`, `MetadataExtractor`, `CustomAttributes` or `VendorExtensionHooks`; the `src/types/vendor-extensions.ts` shim that preserved the pre-move import path is gone. Import these types from `@pie-qti/transform-types`, where they live.
  
  **Breaking: pre-rename extensions metadata is no longer read** (beta prerelease; migrate before upgrading):
  
  - Packages exported while the PIE metadata bag was still named `searchMetaData` no longer import their extensions metadata: the `?? sourceModel.searchMetaData` fallbacks in `@pie-qti/ims-cp-core`'s `extractExtensionsFromQtiXml` and `@pie-qti/to-pie`'s `extractExtensions`, and the `pie:searchMetaData:` LOM source prefix in `@pie-qti/to-pie`'s `readPieResourceLom`, are gone; only `extensions` and the `pie:extension:` prefix are read. `@pie-qti/transform-types` no longer exports `PIE_LOM_LEGACY_EXTENSION_SOURCE`. The QTI package writer (`@pie-qti/pie-to-qti2`) only ever wrote the current forms, so content written by any current release is unaffected.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [e7188e4]
- Updated dependencies [93df941]
- Updated dependencies
- Updated dependencies [b668938]
  - @pie-qti/ims-cp-core@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- fb2b4e2: Converge the zip-extraction safety policy into `@pie-qti/ims-cp-core` (new `./archive-limits` subpath and root exports: `ArchiveExtractionLimits`, `DEFAULT_ARCHIVE_EXTRACTION_LIMITS`, `resolveArchiveLimit`, `exceedsCompressionRatio`). The identical guardrail constants (100 MB compressed / 250 MB uncompressed / 1000 entries / compression-ratio 200), limit validation, and ratio math were copy-pasted across the jszip (browser), unzipper (node), and adm-zip (storage) engines and could drift independently; all three now share the one authority. Engine-specific checks (per-entry size sanity, symlink guards, per-file size limits) remain with each engine. `@pie-qti/storage` gains a dependency on `@pie-qti/ims-cp-core` for the shared policy.
- Updated dependencies [fb2b4e2]
  - @pie-qti/ims-cp-core@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/ims-cp-core@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- @pie-qti/ims-cp-core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- 66f5281: Dependency updates: `jszip` 3.10.2 in `@pie-qti/ims-cp-browser`, `@tiptap/starter-kit` 3.32.0 in `@pie-qti/default-components`, and `@oclif/core` 5.1.8 in `@pie-qti/transform-cli`. No API changes; published dependency ranges move with the bumps.
- @pie-qti/ims-cp-core@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- 953e5d1: Shared catalog files from the content package manifest (G-15, QTI 3.0 §6.3): `loadResolvedManifest` surfaces resources of type `imsqti_catalog_xmlv3p0` as `sharedCatalogs`; `createResolvedItemDeliveryContext` accepts `packageCatalogSources` and the reference backend adapter threads a host-supplied list (`parseAssessmentTestXml({ sharedCatalogs })`, exposed as `QtiAssessmentPlayerConfig.sharedCatalogs`) into every item's delivery context. The item player merges package-scope entries at the bottom, so an item-level `qti-catalog-info` wins a shared identifier and a shared file backs items that declare none.
- Updated dependencies [0d99546]
- Updated dependencies [0edef83]
- Updated dependencies [953e5d1]
  - @pie-qti/ims-cp-core@1.0.0-beta.0

## 0.1.28

### Patch Changes

- @pie-qti/ims-cp-core@0.1.28

## 0.1.27

### Patch Changes

- @pie-qti/ims-cp-core@0.1.27

## 0.1.26

### Patch Changes

- Updated dependencies [ff00d31]
  - @pie-qti/ims-cp-core@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/ims-cp-core@0.1.25

## 0.1.24

### Patch Changes

- @pie-qti/ims-cp-core@0.1.24

## 0.1.23

### Patch Changes

- @pie-qti/ims-cp-core@0.1.23

## 0.1.22

### Patch Changes

- @pie-qti/ims-cp-core@0.1.22

## 0.1.21

### Patch Changes

- @pie-qti/ims-cp-core@0.1.21

## 0.1.20

### Patch Changes

- @pie-qti/ims-cp-core@0.1.20

## 0.1.19

### Patch Changes

- @pie-qti/ims-cp-core@0.1.19

## 0.1.18

### Patch Changes

- @pie-qti/ims-cp-core@0.1.18

## 0.1.17

### Patch Changes

- Updated dependencies [76311bb]
  - @pie-qti/ims-cp-core@0.1.17

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
- Updated dependencies [5a4e39a]
  - @pie-qti/ims-cp-core@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.15

## 0.1.14

### Patch Changes

- @pie-qti/ims-cp-core@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.13

## 0.1.12

### Patch Changes

- @pie-qti/ims-cp-core@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/ims-cp-core@0.1.2
