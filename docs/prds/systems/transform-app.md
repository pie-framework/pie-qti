# PRD: Transform Web Application

<!--
  Status: current
  Type: system
  Packages: @pie-qti/app-transform
  Last reviewed: 2026-04-27
-->

**Status:** current  
**Type:** system  
**Packages:** `@pie-qti/app-transform`  
**Last reviewed:** 2026-04-27

---

## Summary

`@pie-qti/app-transform` is an interactive SvelteKit web application that provides a browser-based interface for the QTI ↔ PIE transformation pipeline. It exposes a four-step workflow — upload QTI content, analyze it to discover items and surface issues, transform it to PIE format, and preview source and output side-by-side — layered over the same `@pie-qti/transform-core` / `@pie-qti/to-pie` engine used by the CLI. The app is primarily a developer and migration-engineering tool, not a learner-facing interface: its intended users are item bank managers migrating QTI content to PIE at scale and engineers validating transform fidelity.

---

## Background and rationale

### Why a web app in addition to the CLI

The CLI (`@pie-qti/transform-cli`) covers batch transformation in automated pipelines. However, it gives no feedback about whether the output renders correctly — a transform can succeed technically while losing visual fidelity (layout breaks, media missing, interaction state wrong). Validating transform quality with the CLI requires separately loading the output in a player, comparing screenshots, and interpreting XML diffs. That workflow is slow and error-prone.

The web app solves two distinct problems:

1. **Migration verification.** Item bank engineers need to see QTI source and PIE output rendered side-by-side to confirm fidelity before committing a migration. No automated diff algorithm is a reliable substitute for human visual inspection of rendered assessment content — interactions have rich formatting, math, media, and passage layout that don't reduce cleanly to structural comparison.

2. **Interactive discovery.** Before a migration, engineers need to understand what is in a QTI package: interaction types, item counts, test structure, passage patterns, and issues like unsupported interaction types that would block transformation. The analyze step surfaces this information without requiring the engineer to read raw XML.

Both use cases are transient: engineers don't need persistent history, user accounts, or multi-user collaboration. A session-scoped upload model with ephemeral storage is sufficient.

### Primary users

- **Migration engineers** running one-off or repeated item bank migrations from QTI to PIE.
- **QA engineers** verifying transform output against source rendering.
- **Framework developers** testing changes to `@pie-qti/to-pie` against real QTI content.

The application is not intended for learners, teachers, or production assessment delivery. It has no login, no persistent user data, and no accessibility requirements beyond basic operational usability.

---

## Functional requirements

- **FR-1:** Accept file uploads via drag-and-drop and click-to-browse. Supported formats: single QTI XML files and ZIP archives (including nested ZIPs and IMS Content Packages with manifests). Maximum upload size: 500 MB per file.

- **FR-2:** On upload, create a UUID-based session, persist files to the configured storage backend, and automatically trigger analysis. Redirect to the session detail page after upload completes.

- **FR-3:** Analysis must discover: item count, passage count, assessment test count, interaction type distribution (counts per type), passage patterns (inline / object / standalone / manifest-dependency), issues blocking transformation (unsupported interaction types), and per-package breakdown when the upload contains multiple packages.

- **FR-4:** Display analysis results as a structured summary on the session detail page, including aggregate stats, interaction type badges, and collapsible per-package detail sections. Show a warning when unsupported interaction types are present, and disable the "Transform to PIE" action in that case.

- **FR-5:** Transform all items in the session on user request, or a specified subset by item ID or assessment ID. Use `@pie-qti/transform-core` with `@pie-qti/to-pie` (`QtiToPiePlugin`). Report per-item success, failure, and warnings. Report overall status as `success`, `partial`, or `failed`.

- **FR-6:** Display transformation results with item list, assessment list, and error list. Allow the user to select any transformed item or assessment and render it via the PIE player.

- **FR-7:** On the session item browser (`/session/[id]/items`), list all discovered QTI items and render the selected item via the QTI item player for source preview.

- **FR-8:** On the transformation results page (`/session/[id]/transformed`), render the selected transformed item via the PIE item player and/or PIE assessment player for output preview.

- **FR-9:** Support session deletion. Prompt for confirmation before deleting. On confirmation, delete all session files from storage and remove the session from the recent-sessions list.

- **FR-10:** Display the five most recent sessions on the home page with ID, status, package count, and relative creation time.

- **FR-11:** Provide built-in sample QTI packages that can be loaded with one click, bypassing the upload step. Samples must enumerate interaction types and item count.

- **FR-12:** Expose an admin interface at `/admin/plugins` that shows: installed transform plugins with source/target formats and priority, registered vendor extensions by type, active storage backend, and all available extension points (storage backends, transform formats, vendor extension types, UI themes, locales).

- **FR-13:** Expose a configuration file mechanism (`config.json`, pointed to by `PIE_QTI_CONFIG` environment variable) that controls storage backend, plugin options, and logging level.

- **FR-14:** When analysis is in progress (session status `extracting` or `analyzing` with no analysis result yet), poll the session endpoint at 2-second intervals and update the UI when analysis completes.

- **FR-15:** Surface session status (`uploaded`, `extracting`, `ready`, `transforming`, `completed`, `error`) as a badge on the session detail page and in the recent sessions list.

---

## Non-functional requirements

### Performance

- Analysis of a single 10-item QTI package must complete within 10 seconds on a local filesystem backend.
- The transform step must show per-item progress feedback (spinner + count) for batches larger than 10 items. The current implementation runs transforms synchronously in the POST handler and returns results in bulk; batch progress via Server-Sent Events is a noted future enhancement (see the comment in `+server.ts` for the analyze endpoint).
- ZIP extraction handles nested ZIPs; recursive extraction depth is bounded by the `StorageZipExtractor` implementation in `@pie-qti/storage`.

### Security

- File type validation on upload: only `application/zip`, `application/x-zip-compressed`, or `.zip` extension are accepted. XML-only uploads are not supported at the upload endpoint (the upload handler rejects non-ZIP files).
- File size is capped at 500 MB per file at the server handler boundary.
- No user authentication or authorization. The app is intended for internal/developer use. If deployed publicly, network-level access control (firewall, VPN, reverse-proxy auth) is required. No CSRF protection is implemented because all state-mutating routes are API endpoints called from the same origin.
- ZIP extraction is handled by `@pie-qti/storage`'s `StorageZipExtractor`. Zip-slip path traversal protection must be enforced inside that implementation.

### Accessibility

- The app is a developer tool, not a learner-facing assessment interface. WCAG 2.2 AA compliance is a goal but not a hard gate for releases. The Playwright test suite includes an accessibility test target (`test:a11y`) using `@axe-core/playwright`.
- All form controls (upload zone, buttons, selects) must have visible labels.
- Color-coded status badges (success/warning/error) must not rely on color alone; status text must be present.
- The session list and item list must be keyboard-navigable.

### Cross-platform

- Desktop browsers (Chrome, Firefox, Safari latest). Tablet is acceptable; phone-size viewports are low priority for this developer tool.

### i18n

- The UI uses `@pie-qti/i18n` (`SvelteI18nProvider`, `i18n.t()`). All visible strings are localized with fallback English strings inline. The locale set loaded at startup covers the configured locales; see `docs/prds/systems/i18n.md`.

---

## Design decisions

### SvelteKit rather than a separate SPA + REST API server

**Decision:** Use SvelteKit's server-side route handlers (in `+server.ts` files) as the API layer, collocated with the Svelte UI in a single deployable process.

**Rationale:** A separate API server and SPA would require CORS configuration, two deployment artifacts, and two build pipelines. SvelteKit's file-system routing puts API handlers next to the pages that consume them, which simplifies both development and deployment. The SvelteKit Node adapter (`@sveltejs/adapter-node`) produces a single Node process that serves both UI and API.

**Alternatives considered:** Express + Vite SPA; Next.js. Both add complexity for a tool whose server-side surface is limited to four API routes. Astro and Remix were not evaluated.

**Consequences:** SvelteKit's routing conventions and server-side load functions add learning overhead. SvelteKit's progressive enhancement model is underutilized since the app is fully client-side interactive. Upgrading SvelteKit major versions will require migration work.

---

### Session-based model without user authentication

**Decision:** Every upload creates an anonymous session identified by a UUID. Sessions are ephemeral — no user accounts, no persistent history across server restarts (with the default filesystem backend), no multi-user access control.

**Rationale:** Item bank migration is a transient task. Engineers run migrations in short bursts, not over days. Requiring authentication would add deployment complexity (identity provider integration, token management) and developer friction that is disproportionate to the benefit. Sessions expire naturally when the server restarts or when the operator clears the uploads directory.

**Alternatives considered:** Simple username/password auth with session cookies. Rejected because there is no requirement for per-user data isolation — all users of a given deployment instance are implicitly trusted.

**Consequences:** Anyone with network access to the server can upload files and consume storage. Public-internet deployments require network-level access controls. Session IDs are `${Date.now()}-${randomBase36}` — this is not cryptographically unguessable, so they should not be treated as access tokens.

---

### BackendAdapter pattern for storage

**Decision:** All file I/O is routed through a `StorageBackend` interface (from `@pie-qti/transform-types`) injected via SvelteKit's `locals` in `hooks.server.ts`. The default backend is the local filesystem.

**Rationale:** Hardcoding `fs` calls in route handlers would make cloud deployments impossible without code changes. The adapter pattern allows the same application code to work with filesystem (local dev, single-server demo), S3, GCS, or a database-backed store by swapping the injected implementation. This is the same pattern used in `@pie-qti/assessment-player` for consistent architectural language across the framework.

**Alternatives considered:** Just use `fs` with an environment variable for the root directory. Rejected because it would require refactoring all storage calls to add cloud support later, and the cost of the abstraction is low.

**Consequences:** All storage operations must go through the `StorageBackend` interface — direct `fs` calls in route handlers are a defect. The `AppSessionStorage` class wraps the core `SessionStorage` with app-specific metadata concerns (analysis.json, transformation.json), following the same pattern.

---

### Side-by-side preview instead of automated diff

**Decision:** The quality gate for transform output is a human reviewer comparing QTI-rendered source (via `pie-qti-item-player`) and PIE-rendered output (via PIE players) side-by-side in the browser. No automated pixel-diff or structural diff is implemented.

**Rationale:** Assessment content has rich visual and interactive requirements: math typesetting, media, passage layout, interaction state feedback. Automated comparison is expensive to implement correctly and fragile — layout differs between renderers by design (PIE components have their own stylesheet). Human visual comparison is faster to implement, catches the issues that matter (broken layout, missing content, wrong interaction type), and doesn't require maintaining a diff baseline. For a developer tool used by engineers rather than automated CI, this tradeoff is appropriate.

**Alternatives considered:** Playwright visual regression tests comparing screenshots. Rejected as a built-in gate; could be added as an optional external step.

**Consequences:** The preview only works when PIE players are installed (`@pie-framework/pie-iife-player`, `@pie-framework/pie-esm-player` — optional peer dependencies). Without them, the PIE preview panel will not render. The local-development setup auto-links a local `pie-players` checkout when present (via postinstall script).

---

### Auto-analyze on upload

**Decision:** The upload handler (`POST /api/upload`) automatically triggers analysis after storing files, rather than requiring the user to explicitly trigger analysis as a separate step.

**Rationale:** Every upload must be analyzed before transformation is possible, so requiring a separate "Analyze" click adds friction without benefit. The separate `POST /api/sessions/[id]/analyze` endpoint still exists for re-analysis and for programmatic use (e.g. after loading a sample).

**Consequences:** If auto-analysis fails, the session is created with status `error` and the analysis error is returned in the upload response. The session is still navigable — the user can retry analysis explicitly via the API.

---

## Extension points

| Extension point | Interface / type | How to configure | Notes |
|---|---|---|---|
| Storage backend | `StorageBackend` from `@pie-qti/transform-types` | `config.json` → `storage.backend`; or register directly in `src/hooks.server.ts` | Default: filesystem. Swap for S3, GCS, or a DB-backed store. |
| Transform plugins | `TransformPlugin` from `@pie-qti/transform-core` | `config.json` → `plugins`; or `engine.use(new MyPlugin())` in the transform handler | The built-in plugin is `QtiToPiePlugin` from `@pie-qti/to-pie`. |
| Vendor extensions | Per-type extension hooks in `@pie-qti/to-pie` | Register in plugin options; visible at `/admin/plugins` under "Vendor Extension Points" | Types include transformers, detectors, asset resolvers. |
| UI themes | DaisyUI theme name | `config.json` → `ui.theme`; or CSS variable override | 32 DaisyUI themes available. |
| i18n locales | Locale message files via `@pie-qti/i18n` | `config.json` → `locales`; or add locale files to the i18n package | See `docs/prds/systems/i18n.md`. |

---

## Data model / contracts

### Session lifecycle

```
uploaded → extracting → ready → (transform requested) → completed
                      → error (at any stage)
```

- `uploaded` — files written to storage, auto-analysis not yet started or in progress
- `extracting` — ZIP extraction underway
- `ready` — extraction and analysis complete; `analysis.json` present in session directory
- `completed` — transformation complete; `transformation.json` present in session directory
- `error` — terminal failure; `session.error` field holds the message

### Session directory layout (filesystem backend)

```
uploads/
└── sessions/
    └── {sessionId}/
        ├── session.json          # Session metadata (status, timestamps)
        ├── analysis.json         # AnalysisResult (written by analyze step)
        ├── transformation.json   # TransformationResult (written by transform step)
        ├── uploads/              # Raw uploaded ZIPs
        └── extracted/            # Extracted content tree
```

### Key types

Defined in `apps/transform/src/lib/server/storage/app-types.ts`:

- `AppSession` — extends `Session` with optional `analysis` and `transformation` fields.
- `AnalysisResult` — session-level aggregate: `totalItems`, `totalPassages`, `totalTests`, `allInteractionTypes` (Record<string, number>), `issues` (string[]), per-package `PackageAnalysis[]`.
- `TransformationResult` — overall `status` (`success` | `partial` | `failed`), `summary` counts, flat `items[]` and `assessments[]` arrays with `pieConfig`, and `errors[]`.

The `allInteractionTypes` field is stored as a plain object (not a `Map`) because JSON serialization of `Map` requires special handling; the analyze handler explicitly converts the `Map` returned by the analyzer to a `Record` before saving.

---

## Acceptance criteria

### Functional

**AC-1: Upload and redirect**
```
Given: the home page is open and no session exists
When: the user drops a valid QTI ZIP file onto the upload zone
Then: the file is uploaded, a new session is created, and the browser navigates
      to /session/{id} within 5 seconds
Notes: the session detail page should show status "ready" if auto-analysis succeeds,
       or "error" if analysis fails
```

**AC-2: Analysis summary visible**
```
Given: a session with a successfully analyzed QTI package
When: the user views the session detail page
Then: the analysis results section shows total items, passages, tests, and package count;
      interaction type badges appear for each type found; the "Transform to PIE" button is enabled
```

**AC-3: Unsupported interaction type blocks transform**
```
Given: a session whose analysis detected an unsupported interaction type (e.g. drawingInteraction)
When: the user views the session detail page
Then: an error alert reading "Cannot Convert to PIE" is displayed; the "Transform to PIE" button
      is disabled; the alert text explains to use the QTI player instead
```

**AC-4: Transformation succeeds**
```
Given: a session in "ready" status with only supported interaction types
When: the user clicks "Transform to PIE"
Then: a spinner is shown, the transform API is called, and on success the browser navigates
      to /session/{id}/transformed showing the count of transformed items and any warnings
```

**AC-5: Transformation error surfaced**
```
Given: the transform API returns an error for one or more items
When: the transformation completes
Then: the results page shows the error count and per-item error messages; successfully
      transformed items are still listed and selectable for preview
```

**AC-6: Item browser loads and renders QTI**
```
Given: a session with at least one analyzed item
When: the user navigates to /session/{id}/items and selects an item from the list
Then: the QTI item player renders the item's XML in the preview panel; the item title
      and interaction type tags are shown in the list entry
```

**AC-7: Transformed item renders in PIE player**
```
Given: a session with at least one successfully transformed item and PIE players installed
When: the user navigates to /session/{id}/transformed and selects an item
Then: the PIE item player renders the transformed PIE config in the preview panel;
      the item identifier and any warnings are shown
```

**AC-8: Session deletion**
```
Given: a session visible in the recent sessions list on the home page
When: the user clicks the delete icon and confirms in the dialog
Then: the session is removed from the list, all session files are deleted from storage,
      and the home page no longer shows the session
```

**AC-9: Recent sessions list**
```
Given: three or more sessions have been created
When: the user views the home page
Then: up to 5 sessions are shown in the recent sessions table with ID, status badge,
      package count, and relative creation time; each row has an "Open" link
```

**AC-10: Sample package loads**
```
Given: the home page shows a sample package card
When: the user clicks "Load Sample"
Then: a session is created from the sample content, analysis runs automatically,
      and the browser navigates to the new session detail page
```

**AC-11: Admin plugins page shows installed plugins**
```
Given: the app is running with the default QtiToPiePlugin loaded
When: the user navigates to /admin/plugins
Then: the installed plugins table shows at least one entry with name, source format "qti22",
      target format "pie", and a priority number; the vendor extensions section shows
      counts (including zeros); the storage backend card shows the configured backend name
```

**AC-12: Config file controls storage backend**
```
Given: a config.json specifying storage.backend = "filesystem" and a custom rootDir
When: the app starts with PIE_QTI_CONFIG pointing to that file
Then: uploaded session files are written to the configured rootDir, not the default location
```

**AC-13: Multi-file ZIP with manifest analyzed correctly**
```
Given: a ZIP containing an imsmanifest.xml and multiple item XML files
When: the file is uploaded and analysis completes
Then: the analysis shows hasManifest = true for that package; item count matches the
      number of assessmentItem elements found; no manifest-related issues are reported
```

**AC-14: Nested ZIP extracted and analyzed**
```
Given: an outer ZIP containing an inner ZIP containing QTI item XML files
When: the outer ZIP is uploaded
Then: analysis discovers the QTI items inside the inner ZIP and includes them in the
      total item count and interaction type breakdown
```

### Error handling

**AC-E1: Oversized file rejected**
```
Given: a ZIP file larger than 500 MB
When: the user attempts to upload it
Then: the upload zone shows an error message indicating the file exceeds the size limit;
      no session is created
```

**AC-E2: Non-ZIP file rejected**
```
Given: a file with a .xml extension (not a ZIP)
When: the user attempts to upload it via the upload zone
Then: the upload handler returns HTTP 400 and the UI shows an error message indicating
      only ZIP files are accepted
Notes: the upload handler accepts .xml extension files at the client level but the
       server rejects non-ZIP MIME types; verify the server-side rejection path
```

**AC-E3: Session not found**
```
Given: a URL pointing to a session ID that does not exist in storage
When: the user navigates to /session/{nonexistentId}
Then: a "Session not found" error page is displayed; the user can navigate back to home
```

**AC-E4: Transform called before analysis**
```
Given: a session in "uploaded" status with no analysis result
When: POST /api/sessions/{id}/transform is called directly
Then: the API returns HTTP 400 with error "Session not analyzed yet"
```

**AC-E5: Analysis failure preserved in session**
```
Given: a ZIP that cannot be extracted (corrupted archive)
When: the user uploads it
Then: the session is created with status "error"; the session detail page shows the
      error message; the Transform button is not shown
```

### Edge cases

**AC-EC1: Analysis already complete, re-analyze is idempotent**
```
Given: a session with status "ready" and an existing analysis.json
When: POST /api/sessions/{id}/analyze is called again
Then: the API returns HTTP 200 with the existing analysis result without re-running analysis;
      the session status remains "ready"
```

**AC-EC2: Empty package (ZIP with no QTI items)**
```
Given: a ZIP containing files but no assessmentItem XML elements
When: analysis completes
Then: totalItems = 0; no interaction types are listed; an issue string noting zero items
      is included; the Transform button is enabled but produces zero results
```

**AC-EC3: Package count in session list is accurate**
```
Given: a session created from a ZIP containing two nested packages (two subdirectories,
       each with its own imsmanifest.xml)
When: the session appears in the home page recent sessions list
Then: the "Packages" column shows 2
```

**AC-EC4: Session ID truncation in UI**
```
Given: a session with a long UUID-style ID
When: the session is shown in breadcrumbs and the session detail header
Then: only the first segment (before the first "-") is shown, not the full ID
Notes: this is cosmetic; the full ID is used in API calls and the URL
```

---

## Open questions

- [ ] **Session expiry policy:** There is no TTL or cleanup job for old sessions. For production deployments, an operator must manually clear the uploads directory. Should the app include a configurable session TTL and a background cleanup process?

- [ ] **Batch transform progress via SSE:** The analyze handler has a comment noting SSE as a future enhancement for progress updates. Should this be implemented before the app is considered production-ready, or is polling sufficient?

- [ ] **XML-only upload support:** The upload handler rejects non-ZIP files. Some QTI vendors distribute individual item XML files. Should the upload handler accept bare `.xml` files and auto-wrap them in a minimal package?

- [ ] **PIE → QTI direction:** The README and context mention `@pie-qti/pie-to-qti2` as a reverse transform. The current app UI only implements QTI → PIE. When (if ever) will the reverse direction be exposed in the web app?

- [ ] **ZIP file limit:** The upload handler caps at 500 MB per file and processes all files from `formData.getAll('files')`. There is no explicit cap on the number of files per upload. Should a per-session or per-upload file count limit be enforced?

---

## Related

- Implementation: `apps/transform/`
- Transform engine: `docs/prds/architecture/transform-engine.md`
- QTI → PIE transform: `docs/prds/architecture/qti-to-pie.md`
- PIE → QTI transform: `docs/prds/architecture/pie-to-qti.md`
- Storage backends: `docs/prds/architecture/storage.md`
- IMS Content Packages: `docs/prds/architecture/ims-content-packages.md`
- CLI tool: `docs/prds/systems/cli.md`
- i18n: `docs/prds/systems/i18n.md`
- Related packages: `@pie-qti/transform-core`, `@pie-qti/to-pie`, `@pie-qti/storage`, `@pie-qti/transform-types`, `@pie-qti/item-player`
