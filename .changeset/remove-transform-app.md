---
---

Remove the internal `@pie-qti/app-transform` reference harness.

The app was a private, non-published SvelteKit playground excluded from supported CI. Product import workflows belong in host applications such as Composer CMS; this repository continues to ship the reusable transform packages (`@pie-qti/transform-core`, `@pie-qti/to-pie`, `@pie-qti/pie-to-qti2`) and the CLI (`@pie-qti/transform-cli`). Documentation that pointed at the harness now describes the package-level host integration pattern instead.

No published package's public API or behavior changes.
