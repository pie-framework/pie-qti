---
'@pie-qti/storage': patch
---

Correct the package's bundler contract and document its environment. The root entry registers the `filesystem`/`s3`/`database` backends into the shared registry at import time; `sideEffects` now declares this (`["./dist/index.js"]`) instead of claiming the package is side-effect free, so bundlers no longer license dropping the registration when the root entry is used. A README documents that the package is Node-only, what each entry targets, the optional AWS peer dependencies, and clarifies that `./session-storage` is a server-side session path manager (browser sessionStorage backends live in `@pie-qti/ims-cp-browser`), that the `database` backend is a throwing stub, and removes a leftover `s3-backend.ts.patch` from `src/`.
