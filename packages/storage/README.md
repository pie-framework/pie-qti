# @pie-qti/storage

Server-side storage backends and session management for the transformation pipeline.

## Environment

**This package is Node-only.** The root entry imports the filesystem backend (Node `fs`) and the
zip extractor (`adm-zip` + Node builtins), so it cannot run in a browser bundle. Browser-side
package storage lives in `@pie-qti/ims-cp-browser` (`SessionStorageBackend` /
`LocalStorageBackend` / `MemoryStorageBackend` — unrelated to this package).

| Entry | Environment | Notes |
| --- | --- | --- |
| `.` (root) | Node | registers the built-in backends into `storageBackendRegistry` at import time (a declared side effect) |
| `./backends/filesystem` | Node | directory-backed blobs |
| `./backends/s3` | Node | lazy-loads `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (optional peer dependencies; methods throw with install guidance when absent) |
| `./backends/database` | Node | **stub** — every method throws; registered under the `'database'` key for demonstration |
| `./session-storage` | Node | server-side session *path/metadata* manager over an injected backend — **not** the browser `sessionStorage` API |
| `./zip-extractor` | Node | `adm-zip`-based extraction with size/entry limits |

## Usage

```ts
import { storageBackendRegistry } from '@pie-qti/storage';

const backend = storageBackendRegistry.create('filesystem', { rootDir: './data' });
```

The root entry pre-registers `filesystem`, `s3`, and `database` factories. Registering the same key
twice throws; register custom backends under distinct keys.

## AWS S3 backend

`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` are optional peer dependencies. Install
them only when the `s3` backend is selected:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## License

MIT
