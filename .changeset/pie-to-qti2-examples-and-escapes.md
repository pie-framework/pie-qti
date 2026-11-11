---
'@pie-qti/pie-to-qti2': patch
---

The package's own XML escaping now has one implementation: `passage-generator` and `manifest-generator` each carried a private `escapeXml` copy alongside the `escapeXmlAttribute` they already consume from `@pie-qti/qti-common/accessibility` (via `utils/qti-builder.ts`). Both copies are deleted and their call sites use `escapeXmlAttribute` directly. Generated QTI and manifest bytes are unchanged — the copies were entity-for-entity identical to the canonical escaper.

Also repairs the documented runnable example: `examples/assessment-transformation.ts` still imported `../../qti2-to-pie/src/plugin.js`, a package path that no longer exists after the rename to `@pie-qti/to-pie`, so the command in `docs/PIE-QTI-TRANSFORMATION-GUIDE.md` and `docs/ASSESSMENT-TRANSFORMATIONS.md` failed. It now imports the workspace packages by name and reads the current round-trip shape (`testParts` → `sections`); the docs command runs clean. `examples/advanced-assessment-features.ts` — referenced nowhere, shipped nowhere, equally broken — is deleted. The pie-to-qti2 README notes that `examples/` scripts are run by hand and are outside the package tsconfig, which is why they rotted silently.
