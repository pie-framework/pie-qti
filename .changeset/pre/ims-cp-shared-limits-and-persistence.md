---
'@pie-qti/ims-cp-browser': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/ims-cp-node': patch
---

Harden and unify the archive-safety boundary that was duplicated per platform:

- **Shared limit rules**: `resolveLimit` and `exceedsCompressionRatio` (entry-count, size, and compression-bomb caps for untrusted packages) now live once in `@pie-qti/ims-cp-core`; the Node and browser packages import them instead of carrying drifted copies.
- **Node manifest hrefs fail closed**: `loadResolvedManifest` previously normalized hostile hrefs — an absolute href like `/etc/passwd` was silently rewritten to `etc/passwd` inside the package. Absolute, protocol-bearing, or encoded-traversal `href`/`file`/`xml:base` values are now rejected with an error, matching the browser's grammar (which drops them). Escape attempts keep throwing.
- **Browser persistence is opt-in**: `openPackage` no longer saves every opened package to `sessionStorage` by default (a quota-bound, text-only snapshot that dropped all binary files on restore — large packages failed to open at all). Pass `persist: true` to keep the old behavior.
