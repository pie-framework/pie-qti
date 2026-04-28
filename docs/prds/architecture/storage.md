# PRD: Pluggable Storage Backends

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/storage, @pie-qti/types
  Last reviewed: 2026-04-27
-->

**Status:** draft  
**Type:** architecture  
**Packages:** `@pie-qti/storage`, `@pie-qti/types`  
**Last reviewed:** 2026-04-27

---

## Summary

`@pie-qti/storage` is the I/O layer for the PIE Transform framework. It provides a
`StorageBackend` interface that hides the difference between a local filesystem, AWS S3,
and any custom store behind a small set of byte-level operations. On top of that interface,
`SessionStorageImpl` (and the app-level `AppSessionStorage` wrapper) organize every transform
job into a predictable directory structure: raw upload, extracted source files, transform
outputs, and two separate metadata documents (session status and the analysis/transformation
results). A module-level registry allows applications and integrators to swap backends at
construction time without touching business logic.

---

## Background and rationale

### Why plain path strings, not URIs

The interface uses `string` paths rather than `URL` objects or a custom URI scheme. Paths are
the lowest-common-denominator token that all three backends understand without translation:
`node:path` on the filesystem, S3 `Key` strings, and hypothetical database `BLOB` row keys.
Introducing a URI type would require every backend to parse and re-serialize on every call,
adding latency and complexity with no benefit in this domain. Callers that need absolute URLs
(for example, generating a browser-downloadable link) use the S3 backend's out-of-band
`getUrl()` / `getUploadUrl()` methods rather than treating the path itself as a URL.

### Why session files are split across subdirectories

A session contains four logical scopes:

| Subdirectory | Content | Write pattern |
|---|---|---|
| `uploads/` | Raw zip uploaded by the user | Single large write, read once |
| `extracted/` | Unzipped source QTI files | Many small writes during extraction |
| `outputs/` | Transform output artifacts | Many small writes during transform |
| `session.json` | Lightweight status record | Tiny, updated frequently |

Keeping status in its own `session.json` avoids the write-amplification that would result
from re-serializing a large analysis blob every time a status field changes. The transform
app's `AppSessionStorage` extends this further by writing `analysis.json` and
`transformation.json` as separate files alongside `session.json`. This means listing all
sessions and showing a dashboard requires only reading `session.json` per session, not the
larger output blobs.

### Why the database backend is a stub

The three-tier deployment story is: filesystem for local dev, S3 for cloud, and "bring your
own relational DB" for enterprise embedding. A production database backend would require
choosing a client library (pg, mysql2, Prisma, etc.) and schema DDL — decisions that should
be made by the embedding application, not the framework. The stub demonstrates the interface
contract and documents the expected schema in comments, but deliberately throws on every
method so that a missed initialization call fails loudly rather than silently writing nowhere.

### Why AWS SDK is loaded dynamically

`@aws-sdk/client-s3` is a large peer dependency (≈500 kB compressed). Applications that only
use the filesystem backend should not pay that cost. The module-level `loadAwsSdk()` function
uses `new Function('specifier', 'return import(specifier)')` to import the SDK at runtime,
bypassing TypeScript's compile-time module resolution so that the package can be built and
shipped without the SDK being installed. If the SDK is absent, `ensureAwsSdk()` throws a
descriptive error at the first I/O call, not at import time. This pattern gives fast startup
for non-S3 deployments and clear error messages for S3 deployments that forget the peer dep.

### Why `enforceSecurity` defaults to `true`

The filesystem backend resolves all caller-supplied paths with `path.resolve(rootDir, input)`
and then checks that the result starts with `rootDir`. Without this check, a caller passing
`../../etc/passwd` (or anything containing `..`) would silently read files outside the
designated root. Defaulting to `true` means the secure behavior is active unless explicitly
disabled, which is the correct default for a web server handling user-uploaded content.
Disabling is provided only for trusted, controlled environments (e.g. developer tooling
running outside a server context).

---

## QTI specification alignment

Not applicable. This subsystem is infrastructure; it has no QTI spec alignment requirements.

---

## Functional requirements

- **FR-1:** The `StorageBackend` interface must expose synchronous `name: string` and async
  `initialize()`, `readText`, `writeText`, `readBuffer`, `writeBuffer`, `write`, `exists`,
  `list`, `delete`, `createReadStream`, `createWriteStream` as required methods.
- **FR-2:** Optional batch (`readBatch`, `writeBatch`), directory (`listFiles`,
  `createDirectory`, `getDirectorySize`), transaction (`beginTransaction`), and metadata
  (`getMetadata`) methods may be omitted by a backend without violating the contract; callers
  must guard with `if (backend.listFiles)` before use.
- **FR-3:** `FilesystemBackend` must reject any path that resolves outside `rootDir` when
  `enforceSecurity` is `true` (default).
- **FR-4:** `S3Backend` must defer AWS SDK loading to first I/O operation; constructing the
  class must not throw even when the SDK is not installed.
- **FR-5:** `DatabaseBackend.initialize()` must throw with a clear "stub" message so that
  mis-configured deployments fail loudly at startup.
- **FR-6:** `StorageBackendRegistry.register()` must throw if a name is already registered,
  preventing silent overwrites.
- **FR-7:** `SessionStorageImpl` must expose `getSessionPath`, `getUploadsPath`,
  `getExtractedPath`, `getOutputsPath` as synchronous path helpers, and async
  `readSessionMetadata`, `writeSessionMetadata`, `deleteSession`, `listSessions`,
  `getSessionSize`.
- **FR-8:** `SessionStorageImpl.listSessions()` must return an empty array (not throw) when
  the sessions directory does not exist or when the backend does not support `listFiles`.
- **FR-9:** The module-level `storageBackendRegistry` must pre-register `filesystem`, `s3`,
  and `database` on first import.
- **FR-10:** `S3Backend` must support a `prefix` option to namespace all keys inside a
  shared bucket.

---

## Non-functional requirements

- **Accessibility:** Not applicable.
- **Performance:** `FilesystemBackend.readBatch` and `S3Backend.readBatch` / `writeBatch`
  must issue reads/writes in parallel (via `Promise.all`), not sequentially.
- **Cross-platform:** `FilesystemBackend` must work on POSIX and Windows paths; use
  `node:path` functions, never string concatenation for path construction.
- **Security:** `FilesystemBackend` must prevent directory traversal by default.
  `S3Backend.getKey` must strip leading `/` to avoid double-slash keys.
- **i18n:** Not applicable.

---

## Design decisions

### Plain-string path API over URI objects

**Decision:** All backend methods accept and return `string` paths.  
**Rationale:** The three backends each have a different native address space (OS path, S3 Key,
DB row key). A unified URI type would add parse/serialize overhead and force every backend to
map between representations. Plain strings are the lowest-friction common denominator.  
**Alternatives considered:** `URL` objects; a custom `StorageUri` tagged type.  
**Consequences:** Callers must not construct paths by hand from user input; they should use
`SessionStorageImpl`'s path helpers, which are the only place paths are assembled.

### Module-level registry singleton

**Decision:** `storageBackendRegistry` is a module-level singleton exported from `index.ts`.
Built-in backends are registered at module import time.  
**Rationale:** Allows applications to register a custom backend once (at startup) and then
use `storageBackendRegistry.create('my-backend', opts)` anywhere. Avoids passing a registry
instance through every call site.  
**Alternatives considered:** Exporting only the `StorageBackendRegistry` class and letting
applications instantiate their own. Retained as an option via the class export.  
**Consequences:** Unit tests that exercise registry registration must call
`registry.unregister(name)` in teardown or use a fresh `new StorageBackendRegistry()` to
avoid "already registered" errors.

### `enforceSecurity` defaults to `true`

**Decision:** `FilesystemBackend` blocks path traversal by default.  
**Rationale:** User-supplied filenames in a web server context are attacker-controlled. A
safe-by-default posture means a developer must explicitly opt out rather than opt in to safety.  
**Alternatives considered:** Require callers to sanitize paths before calling the backend.  
**Consequences:** Developer tooling that intentionally operates across a directory boundary
(e.g. CLI tools reading from a project root) must pass `enforceSecurity: false`.

### Dynamic AWS SDK loading via `Function` constructor

**Decision:** AWS SDK modules are imported at runtime via `new Function('s', 'return import(s)')`.  
**Rationale:** TypeScript's static `import()` in a non-SDK-installed workspace would fail
type-checking or tree-shaking. The `Function` trick bypasses the TypeScript compiler's module
resolution entirely, making the SDK a true optional peer dep.  
**Alternatives considered:** Using `/* @vite-ignore */ import(...)` (build-tool-specific);
wrapping in a try/catch on a dynamic `import()` with `@ts-ignore` (still caught by some
bundlers).  
**Consequences:** No static type safety for AWS SDK types; they are typed as `any`. IDE
autocomplete for SDK internals is lost. This is acceptable because the S3 backend is a thin
adapter; the SDK surface used is narrow and well-tested.

### Session file split (metadata / analysis / transformation)

**Decision:** Status lives in `session.json`; analysis results in `analysis.json`;
transformation results in `transformation.json`.  
**Rationale:** Reduces write amplification. Dashboard list views read only `session.json`
per session. Analysis and transformation blobs can grow large (hundreds of extracted items);
writing them on every status update would be wasteful and error-prone.  
**Alternatives considered:** Single monolithic `session.json` with all fields; separate DB
table per concern.  
**Consequences:** Reading a full `AppSession` requires three backend reads. The
`AppSessionStorage.getSession()` method absorbs this via parallel `Promise.all`.

### Database backend as stub only

**Decision:** `DatabaseBackend` throws on every operation except `createDirectory` (no-op).  
**Rationale:** A real implementation would require committing to a specific DB client and
schema. That decision belongs to the embedding application. The stub documents the interface
and the expected schema; a future implementor creates a concrete subclass.  
**Alternatives considered:** Providing a Knex-based generic implementation.  
**Consequences:** Any application that passes `storageBackendRegistry.create('database', ...)`
will see `initialize()` throw. This is intentional and expected.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|---|---|---|---|
| Custom backend | `StorageBackend` (`@pie-qti/types`) | Implement all required methods; optionally add batch/directory methods. | `class GCSBackend implements StorageBackend { ... }` |
| Registry registration | `storageBackendRegistry.register(name, factory)` | Call at application startup before any `create()` call. | `storageBackendRegistry.register('gcs', opts => new GCSBackend(opts))` |
| Custom factory | `StorageBackendFactory` type | Export from your module; pass to `register()`. | `export const gcsFactory: StorageBackendFactory = (opts) => new GCSBackend(opts)` |
| Session path customization | `SessionStorageOptions.basePath` | Change the root directory for sessions (default: `'sessions'`). | `new SessionStorageImpl(backend, { basePath: 'transform-sessions' })` |
| S3-compatible services | `S3BackendOptions.endpoint` | Point the S3 backend at MinIO, Cloudflare R2, or any S3-compatible API. | `new S3Backend({ bucket, region, endpoint: 'https://minio.internal' })` |

---

## Data model / contracts

All interfaces are defined in `packages/types/src/storage/index.ts`.

### `StorageBackend` invariants

- `name` is read-only and must be stable across the lifetime of the instance.
- `initialize()` must be called before any I/O method; implementations may throw if
  called more than once.
- `list(pattern)` returns `ResourceInfo[]`. `ResourceInfo.uri` is relative to the
  backend root (not an absolute path or URL). The `type` field distinguishes files from
  directories.
- `delete(uri)` on a directory MUST delete recursively (both `FilesystemBackend` and
  `S3Backend` implement this). Callers rely on `deleteSession` using this behavior.
- Optional methods (`listFiles`, `getDirectorySize`, etc.) are guarded by their presence
  on the instance; never assume they exist.

### `Session` shape

```ts
interface Session {
  id: string;
  createdAt: string;       // ISO 8601
  lastAccessedAt?: string; // ISO 8601
  status: string;          // 'uploading' | 'ready' | 'completed' | 'error' (app-defined)
  extractedFiles?: string[];
  error?: string;
}
```

`AppSession` (defined in `apps/transform/src/lib/server/storage/app-types.ts`) extends
`Session` with optional `analysis: AnalysisResult` and `transformation: TransformationResult`.
These are not present in the core `@pie-qti/types` package because they contain
application-specific transform output shapes.

### Session directory layout

```
sessions/
  {sessionId}/
    session.json          ← Session (status)
    analysis.json         ← AnalysisResult (written after analysis step)
    transformation.json   ← TransformationResult (written after transform step)
    uploads/              ← raw ZIP file
    extracted/            ← unzipped QTI source
    outputs/              ← transform output artifacts
```

All paths above are assembled only by `SessionStorageImpl` or `AppSessionStorage`. No
other caller should construct `sessions/` paths by hand.

---

## Acceptance criteria

### Functional

```
AC-1: FilesystemBackend blocks directory traversal
  Given: A FilesystemBackend initialized with rootDir=/tmp/qti-root and enforceSecurity=true
  When: readText('../secret') is called
  Then: The call throws an error containing "Path security violation"
  Notes: Use path.resolve to verify the check works even with encoded sequences.

AC-2: FilesystemBackend allows traversal when security disabled
  Given: A FilesystemBackend initialized with enforceSecurity=false
  When: An absolute path outside rootDir is passed to readText
  Then: The call succeeds (or throws ENOENT, not a security error)

AC-3: S3Backend defers SDK load
  Given: @aws-sdk/client-s3 is NOT installed in the test environment
  When: new S3Backend({ bucket: 'x', region: 'us-east-1' }) is constructed
  Then: Construction completes without throwing
  When: readText('/any/path') is called
  Then: The call throws an error mentioning "AWS SDK not found"

AC-4: Registry rejects duplicate registration
  Given: A fresh StorageBackendRegistry
  When: register('filesystem', factory) is called twice
  Then: The second call throws "already registered"

AC-5: Registry throws on unknown backend
  Given: A StorageBackendRegistry with only 'filesystem' registered
  When: create('s3', {}) is called
  Then: The call throws an error listing available backends

AC-6: DatabaseBackend.initialize throws
  Given: new DatabaseBackend({ connectionString: 'postgres://...' })
  When: initialize() is called
  Then: The call throws an error containing "stub implementation"

AC-7: SessionStorageImpl.listSessions returns empty array when directory missing
  Given: A SessionStorageImpl wrapping a FilesystemBackend pointing at an empty rootDir
  When: listSessions() is called
  Then: Returns [] without throwing

AC-8: Session file split — metadata written independently
  Given: A SessionStorageImpl and an AppSessionStorage wrapping the same backend
  When: saveAnalysis(sessionId, result) is called
  Then: analysis.json is written under sessions/{sessionId}/
  And: session.json is updated (status → 'ready', lastAccessedAt updated)
  And: transformation.json is NOT written or modified

AC-9: S3Backend prefix namespacing
  Given: An S3Backend initialized with prefix='envA'
  When: writeText('sessions/abc/session.json', '{}') is called
  Then: The S3 key used is 'envA/sessions/abc/session.json'

AC-10: Built-in backends pre-registered on import
  Given: The @pie-qti/storage package is imported
  When: storageBackendRegistry.getRegisteredNames() is called
  Then: Returns an array containing 'filesystem', 's3', and 'database'
```

### Edge cases

```
AC-E1: FilesystemBackend.delete on non-existent path does not throw
  Given: A FilesystemBackend
  When: delete('sessions/nonexistent') is called
  Then: Resolves without throwing

AC-E2: S3Backend.createDirectory is a no-op
  Given: A configured S3Backend
  When: createDirectory('any/path') is called
  Then: Resolves without throwing and without making any S3 API call

AC-E3: getDirectorySize returns 0 for missing directory (filesystem)
  Given: A FilesystemBackend with a clean rootDir
  When: getDirectorySize('sessions/no-such-session') is called
  Then: Returns 0

AC-E4: readBatch skips missing files without throwing
  Given: A FilesystemBackend
  When: readBatch(['exists.json', 'no-such-file.json']) is called
  Then: Returns a Map with one entry ('exists.json' → content); 'no-such-file.json' is absent
```

---

## Open questions

- [ ] Should `StorageBackend.list(pattern)` support glob wildcards across all backends, or
  is the current "treat pattern as directory path" behavior sufficient? The filesystem backend
  partially implements this but the glob expansion is incomplete.
- [ ] Should `SessionStorageImpl` expose a `cleanupExpiredSessions(maxAgeMs)` method, or
  should session expiry be an application-level concern?

---

## Related

- Implementation: `packages/storage/src/`
- Type definitions: `packages/types/src/storage/index.ts`
- App-layer extension: `apps/transform/src/lib/server/storage/`
- Adjacent PRDs: `architecture/transform-engine.md` (how the transform pipeline calls storage)
