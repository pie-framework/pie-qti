---
'@pie-qti/assessment-player': patch
'@pie-qti/item-player': patch
---

Remove unused public API from `@pie-qti/item-player` (verified zero consumers repo-wide): `PerformanceMonitor`/`globalPerformanceMonitor` (and `@pie-qti/assessment-player`'s dead re-export shim), the `core/constants` star-export, `isResponseEmpty`/`countAnsweredForResponseIds`, `QTIInteractionBase` (no web-component subclassers exist — the `/web-components` entry keeps the event classes and types that consumers use), and a drifted duplicate of the MathLive editor extension. The extraction package's `VariableDeclaration` (a divergent, smaller shape that shadowed the main one in the root barrel under the same name) is renamed to `ExtractionVariableDeclaration`. "Meaningful response" logic used by response validation and attempted-state tracking now shares one implementation instead of two verbatim copies.
