---
'@pie-qti/demo-vendor-extensions': patch
'@pie-qti/pie-to-qti2': patch
'@pie-qti/storage': patch
'@pie-qti/to-pie': patch
---

Update `adm-zip` and `uuid` to versions without published advisories.

- `@pie-qti/storage`: `adm-zip` `^0.5.16` → `^0.6.0` (CVE-2026-39244, high — a crafted
  ZIP can trigger a 4 GB memory allocation). This is the one with real exposure here:
  `storage/src/zip-extractor.ts` extracts untrusted QTI content packages. Its
  pre-extraction limits (100 MB compressed, 250 MB uncompressed, 1000 entries, ratio 200)
  check sizes advertised in the central directory, so they reduce but do not necessarily
  prevent an allocation made while the archive itself is parsed.
- `@pie-qti/to-pie`, `@pie-qti/pie-to-qti2`: `uuid` `^10.0.0` → `^11.1.1`
  (CVE-2026-41907, moderate).
- `@pie-qti/demo-vendor-extensions`: `uuid` `^11.0.5` → `^11.1.1`. This resolved to
  `uuid@11.1.0`, which is also below the patched version, and was not covered by an
  advisory alert.

The `uuid` advisory concerns a missing buffer bounds check in `v3`/`v5`/`v6` when a `buf`
argument is supplied. Every call site in this repository uses `v4()` with no arguments,
so it was not reachable; these bumps clear the advisory rather than fix an exploitable
path.

Also drops `@types/uuid` from `to-pie` and `pie-to-qti2`. It is a deprecated stub
("uuid provides its own type definitions, so you do not need this installed") and was
pinned at `^10.0.0`, one major behind the runtime package whose bundled types it shadowed.

Both dependencies are external to the published bundles — consumers resolve them from
their own `node_modules` — so the updated ranges reach consumers directly.
