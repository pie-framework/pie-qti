---
'@pie-qti/transform-core': patch
---

One dynamic module loader instead of two byte-identical copies: `loadPlugin` (`config/plugin-loader.ts`) and the vendor registry's private `loadVendorModule` (`config/vendor-registry.ts`) both implemented the same dynamic-import / export-lookup / instantiate / rewrap sequence and now delegate to a shared `loadConfiguredModule(config, kind)` in `config/module-loader.ts` (internal — not added to the public surface). The two entry points keep their exact error messages ("Failed to load plugin from …" / "Failed to load vendor extension from …"), and `registerExtensions`' five copy-pasted registration blocks (detectors, transformers, asset resolvers, CSS class extractors, metadata extractors) collapse into a per-kind loop that preserves the registration order, the skip-if-hook-missing behavior and the warn text verbatim. No behavior change; the config and plugin-loader suites pass untouched.
