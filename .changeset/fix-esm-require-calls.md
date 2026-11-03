---
'@pie-qti/demo-vendor-extensions': patch
'@pie-qti/pie-to-qti2': patch
---

Fix `ReferenceError: require is not defined` crashes in ESM builds. `createAcmeExtensions()` in `@pie-qti/demo-vendor-extensions` threw on every call under Node, and `@pie-qti/pie-to-qti2`'s assessment transform threw for every PIE assessment conversion while package validation always failed with "Failed to generate manifest". Both packages are ESM (`"type": "module"`), where `require` does not exist; the calls now use static imports. Bun-based consumers were unaffected because Bun shims `require` in ESM.
