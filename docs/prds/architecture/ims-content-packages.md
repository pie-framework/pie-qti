# PRD: IMS Content Package Support

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/ims-cp-core, @pie-qti/ims-cp-browser, @pie-qti/ims-cp-node
  Last reviewed: 2026-04-27
-->

**Status:** draft  
**Type:** architecture  
**Packages:** `@pie-qti/ims-cp-core`, `@pie-qti/ims-cp-browser`, `@pie-qti/ims-cp-node`  
**Last reviewed:** 2026-04-27

---

## Summary

The IMS CP subsystem opens, parses, and navigates IMS Content Package v1.1.4 ZIP archives that contain QTI 2.x assessment items. It is split across three packages: `ims-cp-core` (isomorphic parse logic, zero platform APIs), `ims-cp-browser` (ZIP extraction via JSZip, `VirtualPackage` with pluggable storage), and `ims-cp-node` (ZIP extraction via unzipper, filesystem resolution). All three share the same `ParsedManifest` and `ResolvedManifest` data models from core. The subsystem also provides passage reusability detection (`PassageRegistry`, `generateStablePassageId`), BCP 47 locale grouping with four-step fallback, and a `QtiHeuristicsConfig` opt-in layer for content from authoring tools that diverge from the spec. The open gap G-15 (shared external catalog files) is tracked in `docs/SPEC-GAPS-PLAN.md`.

---

## Background and rationale

### Why three packages instead of one

QTI tooling runs in three distinct environments: the browser (the transform web app and item preview), Node.js (the CLI and server-side batch transform), and test runners (which can be either). The ZIP-extraction and path-resolution code for each environment uses different runtime APIs (`File`/JSZip vs. `fs`/unzipper vs. nothing), and bundling all three into one package would force browser bundles to include Node.js imports and vice versa, breaking tree-shaking and adding dead weight to the browser bundle.

The split is: **core** = pure TypeScript, no I/O, no platform globals; **browser** = core + JSZip + `sessionStorage`; **node** = core + `fs`/`path`/unzipper. Both browser and node depend on core via `workspace:*`. Any future WASM or Deno target would add a fourth runtime package that depends only on core.

### Why stable IDs are async

`generateStablePassageId` is an `async` function even though two of its three strategies (QTI identifier and file path) are synchronous. The third strategy — content hashing for inline stimuli — calls `sha256()`, which in browsers must use the Web Crypto API (`crypto.subtle.digest()`), and that API is always asynchronous. Making the entire function synchronous would require a synchronous hash implementation (e.g., a bundled pure-JS SHA-256), which would increase the bundle size and diverge from the platform-native path. Making the async signature the only public interface means callers always `await` it, which is safer than a mixed sync/async API where callers might forget to await in the async case.

### Why the passage registry needs reference counting

A `PassageRegistry` tracks which items reference each passage. The `isReusable` flag on a `PassageReference` is set to `true` only when `referencedBy.size > 1` — i.e., two or more items list the same passage as a dependency. This information drives two decisions downstream:

1. The transform pipeline decides whether to embed passage content inline in each item's PIE model or to emit it as a shared resource that multiple items reference.
2. Future rendering optimisation: a shared passage that is displayed alongside multiple items in a test section can be pre-loaded once.

Without reference counting, the pipeline has no way to distinguish a single-use passage (safe to inline) from a multi-use one (must be shared), which would either waste bandwidth (inlining the same content repeatedly) or incorrectly assume every passage is shared (over-engineering single-use items).

The `detectAndMergeDuplicates()` method is a second pass that identifies passages with identical content but different identifiers (a common authoring artifact). It uses SHA-256 hashing to detect content equality, which is why the registry's merge operation is also async.

### Why the locale fallback has four steps

The four-step chain `[exact, lang-only, default, default-lang-only]` covers the practical combinations a K-12 content bank produces:

1. **Exact match** (`es-ES`) — the content bank has a region-specific variant and the consumer wants that region.
2. **Language-only** (`es`) — a variant exists without a region tag (common for "neutral Spanish" or older content).
3. **Default locale** (`en-US`) — no Spanish variant exists at all; fall back to the English master.
4. **Default language-only** (`en`) — the default locale in the bank uses a region tag but the consumer has already tried it, and we try a bare language tag as a last-resort before returning the first available variant.

Stopping at two steps would miss cases where the bank has `en` (bare) but the default locale is `en-US`. Stopping at three steps would miss case 4. The existing five-step rule (four explicit + "first available") ensures the system never returns `undefined` for a non-empty group, which simplifies callers.

The `getLocaleFallbackChain()` function deduplicates entries, so requesting `en-US` with default `en-US` produces `["en-US", "en"]` rather than `["en-US", "en", "en-US", "en"]`.

---

## QTI specification alignment

- **Spec version(s):** IMS CP v1.1.4 (primary); QTI 2.1, 2.2 resource types
- **Spec section(s):** IMS CP specification §4 (manifest structure); `docs/IMS_Content_Packages_techguide.md` (local reference); QTI 2.2 resource type identifiers (`imsqti_item_xmlv2p2`, `imsqti_test_xmlv2p2`)
- **Supported resource types:** `imsqti_item_xmlv2p1`, `imsqti_item_xmlv2p2`, `imsqti_test_xmlv2p1`, `imsqti_test_xmlv2p2`, `imsqti_assessment_xmlv2p1`, `imsqti_apip_xmlv2p2`, `webcontent`, `associatedcontent/imsqti_item_xmlv2p1`
- **Deliberately omitted:** Sub-manifest nesting (the parser finds the top-level `<resources>` element only). Sub-manifests inside `<manifest>` children are not recursed into.
- **Known divergences:** Passage detection uses a heuristic: `webcontent` resources and resources with `apip` in the type are classified as passages. The IMS CP spec does not define a passage type; this is an application-level convention adopted from QTI packaging practice.
- **G-15 gap:** Shared external catalog files (`imsqti_catalog_xmlv3p0` resource type) are not yet detected or loaded by `PackageLoader`. Items that rely on package-level catalogs instead of inline `<qti-catalog>` elements will silently receive no catalog data. See `docs/SPEC-GAPS-PLAN.md` §G-15.

---

## Functional requirements

- **FR-1:** `parseManifest(xml)` must parse any IMS CP v1.1.4 manifest and return a `ParsedManifest` with `resources`, `items`, `passages`, and `tests` populated. It must not throw for well-formed XML even if no resources are present.
- **FR-2:** `ParsedManifest.resources` is a `Map<string, ManifestResource>` keyed by `identifier`. Duplicate identifiers in the manifest must not silently discard earlier entries — last-write wins is acceptable; a warning should be emitted.
- **FR-3:** `loadResolvedManifest()` (both browser and node variants) must resolve all `href` and `file` attributes relative to `xml:base` attributes at the manifest and resource levels, producing package-relative POSIX paths.
- **FR-4:** `openContentPackage()` (Node.js) must extract a `.zip` or `.imscc` file to a temporary directory with path traversal protection; entries with `..` in their path must be silently skipped.
- **FR-5:** `extractPackage()` (browser) must reject packages exceeding `maxFiles` (default 1000) and read text files as `string`, binary files as `Blob`.
- **FR-6:** `generateStablePassageId()` must return the `qtiIdentifier` verbatim (no prefix added) when one is provided, return a normalised `{prefix}-{path}` string when only a file path is provided, and return a `{prefix}-content-{12-char-sha256}` string when only content is provided.
- **FR-7:** `PassageRegistry.registerReference()` must update `isReusable` to `true` on the existing `PassageReference` as soon as a second item references the same passage ID.
- **FR-8:** `buildLocalizedManifest()` must group all resources (items, passages, tests) by their `baseId` (identifier with locale suffix stripped) and expose `availableLocales` as the union of all locales across all groups.
- **FR-9:** `selectLocalizedResource()` must return the first available variant when the fallback chain is exhausted, never `undefined` for a non-empty group.
- **FR-10:** `findManifestPath()` (Node.js) and `findManifestInFiles()` (browser) must check the package root first, then scan subdirectories breadth-first, skipping `node_modules` and dot-prefixed directories.

---

## Non-functional requirements

- **Performance:** `parseManifest()` must complete in under 100 ms for manifests with up to 500 resources on a 2022 mid-range laptop. `openContentPackage()` and `extractPackage()` are I/O-bound; no performance target is specified, but they must not block the event loop in browser contexts (all async).
- **Security (Node.js):** `extractZipToDirSafe()` must reject any zip entry whose path contains `..` or starts with `/` or `\`, and must verify that the resolved output path is under `targetDir` before writing. See `isUnsafeZipEntryPath()` and `assertPathWithinDir()` in `packages/ims-cp-node/src/index.ts`.
- **Security (browser):** File size and file count limits on `extractPackage()` prevent memory exhaustion from maliciously large ZIP files. Default limits: 50 MB per file, 1000 files.
- **Isomorphism:** No code in `ims-cp-core` may import from `node:fs`, `node:path`, `node:os`, or any browser-only global (e.g., `File`, `Blob`, `sessionStorage`). Violations break the package in one or both environments.
- **Cross-platform paths:** All package-relative paths produced by the subsystem must use POSIX separators (`/`), regardless of the host OS. Absolute filesystem paths in `ims-cp-node` use the host OS separator via `path.resolve()` but are only ever passed to `toAbsolutePath()` or Node.js `fs` functions.
- **i18n:** The locale system supports BCP 47 locale codes in the forms `ll`, `ll-RR`, and `ll_RR` (underscore normalised to hyphen). No RTL or number-format handling is performed; the subsystem only selects resources.

---

## Design decisions

### `ParsedManifest` uses a `Map` for resources, arrays for typed subsets

**Decision:** `resources` is `Map<string, ManifestResource>` for O(1) identifier lookup; `items`, `passages`, and `tests` are pre-filtered arrays derived from the same resource set.  
**Rationale:** Most callers need fast lookup by identifier (to resolve `dependency` and `identifierref` references) and iteration over a typed subset. Providing both avoids repeated linear scans over the full resource map.  
**Alternatives considered:** A single `Map` with typed filtering on every access was considered and rejected because repeated filtering creates temporary arrays on each call.  
**Consequences:** If a resource changes type (possible with vendor-extended type strings), it appears in both the `Map` and the wrong typed array until the manifest is re-parsed. The manifest parser is not designed for mutation.

### `xml:base` is resolved by both the node and browser packages, not by core

**Decision:** Core's `parseManifest()` preserves `xmlBase` as an opaque string on `ManifestResource` and `ParsedManifest`. Path joining is done by the runtime packages.  
**Rationale:** Core must not import `path` (Node.js) or use URL APIs that behave differently across environments. Both runtime packages implement `applyXmlBase()` and `joinPosix()` with identical semantics but using their own platform's path utilities.  
**Alternatives considered:** Core could use `URL` (available in both environments since Node.js 10) for path resolution. This was considered but would complicate the `basePath` parameter semantics, which is a filesystem root in Node.js but a virtual root in the browser.  
**Consequences:** The `applyXmlBase` and `joinPosix` functions are duplicated between the browser and node packages. They must be kept in sync. A future refactor could extract them into a `path-utils.ts` within core.

### SHA-256 hashing is platform-adaptive, not bundled

**Decision:** `sha256()` in `ims-cp-core/utils/hash.ts` branches on `crypto.subtle` (browser) vs. `import('crypto')` (Node.js).  
**Rationale:** Using the platform-native hash avoids bundling a pure-JS implementation (~3 KB). The runtime check is safe — `crypto.subtle` is available in all modern browsers and in Node.js 15+.  
**Alternatives considered:** A bundled pure-JS SHA-256 implementation would be synchronous and simpler, but adds bundle weight to the browser build and is unnecessary.  
**Consequences:** `generateStablePassageId()` is async regardless of which strategy is used. Any code that calls it must be async.

### `VirtualPackage` abstracts over the browser storage backends

**Decision:** The browser package exposes a `StorageBackend` interface with `SessionStorageBackend`, `LocalStorageBackend`, and `MemoryStorageBackend` implementations. `openPackage()` defaults to `SessionStorageBackend`.  
**Rationale:** The transform web app needs to survive a page reload (so the user does not need to re-upload the ZIP). `SessionStorage` provides persistence across reloads within the same tab without requiring IndexedDB complexity. The interface allows the demo/test app to use `MemoryStorageBackend` without cross-origin storage permission requirements.  
**Alternatives considered:** IndexedDB for larger packages was considered and deferred; `sessionStorage` is sufficient for the expected package sizes (< 50 MB).  
**Consequences:** Binary files are serialised to base64 for storage, doubling their memory footprint while in storage. Large image-heavy packages may exhaust `sessionStorage` quota (~5 MB in most browsers).

### Passage heuristics are opt-in, not silent

**Decision:** `QtiHeuristicsConfig` defaults to `enabled: true` but every heuristic can be individually disabled. Applications that require strict QTI-only processing pass `STRICT_QTI_CONFIG`.  
**Rationale:** Real-world QTI packages from authoring tools routinely deviate from the spec in minor ways (semicolons after feedback labels, loose image paths). A strict parser would reject or silently mis-render these. The heuristics layer makes these adjustments explicit, documented, and disableable.  
**Alternatives considered:** Silent heuristics (always on, no config) were rejected because they would hide spec deviations from operators and make debugging harder.  
**Consequences:** Tools that want strict QTI validation must pass `STRICT_QTI_CONFIG` explicitly. The default mode produces "better" output at the cost of hiding authoring errors.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| Storage backend (browser) | `StorageBackend` | Implement `get`, `set`, `delete`, `list`; pass to `openPackage({ storage })` | `MemoryStorageBackend` in `packages/ims-cp-browser/src/storage.ts` |
| Manifest parsing (isomorphic) | `parseManifest(xml, basePath?)` | Call from any environment; returns `ParsedManifest` | Used by both browser's `loadResolvedManifest` and node's `loadResolvedManifest` |
| Passage ID strategy | `generateStablePassageId(options)` | Pass whichever of `qtiIdentifier`, `filePath`, or `content` is available | `packages/ims-cp-core/src/passage-reusability.ts` |
| Locale selection | `selectLocalizedResource(group, locale, defaultLocale)` | Call after `buildLocalizedManifest()` to pick the best variant | `packages/ims-cp-core/src/localized-resources.ts` |
| Heuristics config | `QtiHeuristicsConfig` | Pass `STRICT_QTI_CONFIG` for spec-only mode; `DEFAULT_HEURISTICS_CONFIG` otherwise | `packages/ims-cp-core/src/qti-heuristics.ts` |
| Package graph | `buildPackageGraph({ manifest, fileAccess })` → `{ resources, assets, closures, diagnostics }` | Call after `loadResolvedManifest` to get a resource graph keyed by identifier, an asset inventory with `ownerResourceIds` / `sourcePaths`, per-test/passage closures, and structured diagnostics (`IMS_CP_MISSING_FILE`, `IMS_CP_MISSING_ASSET`, `IMS_CP_DANGLING_ITEM_REF`). `assessmentItemRef` paths are resolved back to `PackageResourceNode`s. | Consumed by `transformQtiPackageToPie` in `@pie-qti/to-pie` to feed source-profile detection, sidecar emission, and package-level diagnostic rollup |

---

## Data model / contracts

All key types are in `packages/ims-cp-core/src/`. Key invariants:

**`ManifestResource`**
- `identifier` is the raw value from the manifest's `identifier` attribute. It is not normalised or validated for global uniqueness.
- `files` includes the entry pointed to by `href` (if any) plus any additional `<file>` children. Callers should not assume `href` and `files[0]` are always the same.
- `dependencies` is a list of `identifierref` values (references to other resource identifiers). The manifest parser does not validate that referenced identifiers exist.

**`ParsedManifest`**
- `resources` is the source of truth. `items`, `passages`, and `tests` are views derived at parse time using `isItemType()`, `isPassageType()`, and `isTestType()`.
- `basePath` is the filesystem root directory passed to `parseManifest()`; used only by Node.js callers to resolve relative paths to absolute paths.

**`ResolvedManifest` (browser / node)**
- `hrefResolved` is a package-relative POSIX path (e.g., `items/q1.xml`). It is `undefined` when the resource has no `href` and no `<file>` children.
- `filesResolved` always contains at least the `hrefResolved` path when `hrefResolved` is present.
- Node.js callers use `toAbsolutePath(packageRoot, resource.hrefResolved)` to get an absolute filesystem path. Browser callers use `pkg.readText(resource.hrefResolved)` on the `VirtualPackage`.

**`PassageReference`**
- `isReusable` is computed lazily by the registry: it becomes `true` on the second `registerReference()` call for the same passage ID, and never reverts to `false`.
- `source` values: `'inline'` = content was embedded in the QTI item body; `'file'` = referenced via `<object data="..."/>`; `'manifest'` = declared as a `<resource>` with a passage-type; `'qti-element'` = `<assessmentStimulus>` or `<assessmentPassage>` element.

**`LocalizedManifest`**
- `itemGroups`, `passageGroups`, `testGroups` all use the same `baseId` extraction: the identifier with any trailing `[._-][a-z]{2}([_-][A-Z]{2})?` suffix stripped.
- `availableLocales` is the union across all groups; a locale appears here even if only one item has that locale.
- Non-localized resources (no locale suffix, no LOM language metadata) are assigned the `defaultLocale` passed to `buildLocalizedManifest()`, making them visible in all locale-aware lookups.

---

## Acceptance criteria

### Functional

```
AC-1: Manifest with items and tests is parsed correctly
  Given: A valid imsmanifest.xml with two imsqti_item_xmlv2p2 resources and one imsqti_test_xmlv2p2 resource
  When: parseManifest(xml) is called
  Then: parsed.items has length 2
        AND parsed.tests has length 1
        AND parsed.passages has length 0
        AND parsed.resources.size === 3
```

```
AC-2: xml:base propagates to file hrefs
  Given: A manifest with xml:base="content/" on <resources> and a resource with href="items/q1.xml"
  When: loadResolvedManifest() is called
  Then: resource.hrefResolved === "content/items/q1.xml"
```

```
AC-3: Browser package opens ZIP and returns VirtualPackage
  Given: A browser File object containing a valid QTI package ZIP with imsmanifest.xml at root
  When: openPackage(file) is called
  Then: The returned VirtualPackage.manifest.items.length > 0
        AND pkg.readText(pkg.manifest.items[0].hrefResolved) returns an XML string
        AND the string starts with "<?xml" or "<assessmentItem"
```

```
AC-4: Node.js package extracts ZIP and resolves manifest
  Given: A .zip file containing a QTI package
  When: openContentPackage(zipPath) is called followed by loadResolvedManifest(pkg.packageRoot)
  Then: manifest.items is a non-empty array
        AND toAbsolutePath(pkg.packageRoot, manifest.items[0].hrefResolved) points to an existing file
  Notes: Call pkg.close() after the test to remove the temp directory.
```

```
AC-5: Node.js ZIP extraction rejects path traversal
  Given: A ZIP containing an entry with path "../../etc/passwd"
  When: extractZipToDirSafe(zipPath, targetDir) is called
  Then: The entry is skipped (not extracted)
        AND no file appears outside targetDir
        AND the function resolves (does not throw)
```

```
AC-6: generateStablePassageId uses qtiIdentifier verbatim
  Given: options = { qtiIdentifier: "urn:acme.com:passages:p42" }
  When: await generateStablePassageId(options)
  Then: result === "urn:acme.com:passages:p42"  (no prefix added)
```

```
AC-7: generateStablePassageId falls back to file path
  Given: options = { filePath: "./shared/context1.html" }
  When: await generateStablePassageId(options)
  Then: result === "passage-shared-context1"  (leading ./ stripped, / replaced by -, .html stripped)
```

```
AC-8: generateStablePassageId falls back to content hash
  Given: options = { content: "<p>The Industrial Revolution began...</p>" }
         AND the same call is made twice with identical content
  When: await generateStablePassageId(options) is called twice
  Then: both calls return the same string
        AND the string starts with "passage-content-"
        AND the hash portion is 12 characters
```

```
AC-9: PassageRegistry tracks reusability
  Given: A PassageRegistry
         AND registerReference("item-1", { id: "stim-01", ... }) is called
         AND registerReference("item-2", { id: "stim-01", ... }) is called
  When: registry.getReference("stim-01") is read
  Then: reference.isReusable === true
        AND registry.getReferencingItems("stim-01").size === 2
```

```
AC-10: Locale fallback chain produces correct order
  Given: requestedLocale = "es-MX", defaultLocale = "en-US"
  When: getLocaleFallbackChain("es-MX", "en-US")
  Then: result === ["es-MX", "es", "en-US", "en"]
```

```
AC-11: selectLocalizedResource falls back when exact locale missing
  Given: A LocalizedResourceGroup with variants for "en-US" and "es-ES" only
  When: selectLocalizedResource(group, "es-MX", "en-US")
  Then: the "es-ES" variant is returned  (es-MX → es → found es-ES)
```

```
AC-12: selectLocalizedResource falls back to first available when nothing matches
  Given: A LocalizedResourceGroup with only an "fr-FR" variant
  When: selectLocalizedResource(group, "zh-CN", "en-US")
  Then: the "fr-FR" variant is returned (all fallbacks exhausted, first-available returned)
```

```
AC-13: Non-localized package is accessible at any locale
  Given: A manifest with resources that have no locale suffix and no LOM language metadata
         AND buildLocalizedManifest(manifest, "en-US") is called
  When: getAllItemsForLocale(localizedManifest, "es-ES")
  Then: all items are returned (non-localized resources are assigned "en-US", which is reached via fallback)
```

### Edge cases

```
AC-E1: Empty manifest parses without error
  Given: A manifest XML with <resources/> (no resources)
  When: parseManifest(xml)
  Then: returns ParsedManifest with resources.size === 0 and items/passages/tests all empty arrays
        AND no exception is thrown
```

```
AC-E2: Browser package rejects ZIP exceeding maxFiles
  Given: A ZIP with 1001 files and maxFiles = 1000
  When: extractPackage(file, { maxFileSize, maxFiles: 1000 }) is called
  Then: the promise rejects with an error message mentioning the file count limit
```

```
AC-E3: generateStablePassageId throws when no option is provided
  Given: options = {} (all fields undefined)
  When: await generateStablePassageId(options)
  Then: the promise rejects with an Error
```

```
AC-E4: detectAndMergeDuplicates merges identical passage content
  Given: Two PassageReference entries with different IDs but identical stored content
  When: await registry.detectAndMergeDuplicates()
  Then: the returned mergeMap has size 1 (one ID mapped to the other)
        AND the surviving entry's referencedBy includes items from both merged entries
        AND the merged entry's isReusable is updated accordingly
```

---

## Open questions

- [ ] **G-15 (shared external catalog files):** The manifest parser recognises no `imsqti_catalog_xmlv3p0` resource type. When should this be implemented? The gap is Tier 3 (deferred) in `docs/SPEC-GAPS-PLAN.md`. The `PackageLoader` in `ims-cp-browser` would need a second pass to detect and expose catalog resources after manifest parsing.
- [ ] **Sub-manifest support:** The manifest parser ignores nested `<manifest>` elements. Is this a real-world concern for any content banks the framework targets?
- [ ] **`detectAndMergeDuplicates()` timing:** This is called in one place (batch transform). Should it be called automatically by the registry after a configurable call count, or always explicitly by the caller?
- [ ] **`sessionStorage` quota for large packages:** The 50 MB browser limit plus base64 encoding overhead can exceed typical `sessionStorage` quotas. Should `ims-cp-browser` fall back to IndexedDB automatically, or should this be an explicit caller choice?

---

## Related

- Spec reference: `docs/IMS_Content_Packages_techguide.md`
- G-15 gap: `docs/SPEC-GAPS-PLAN.md` §G-15
- Core types: `packages/ims-cp-core/src/manifest-parser.ts`, `packages/ims-cp-core/src/passage-reusability.ts`, `packages/ims-cp-core/src/localized-resources.ts`
- Browser runtime: `packages/ims-cp-browser/src/package-loader.ts`, `packages/ims-cp-browser/src/virtual-package.ts`, `packages/ims-cp-browser/src/storage.ts`
- Node.js runtime: `packages/ims-cp-node/src/index.ts`
- IMS CP v1.1.4 specification: https://www.imsglobal.org/content/packaging/cpv1p1p4/imscp_v1p1p4.html
