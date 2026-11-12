---
'@pie-qti/web-component-loaders': patch
---

`loadPieQtiPlayerElements` now clears its cached import promise when the dynamic import rejects, so a transient chunk failure (blocked network, stale-deploy 404) no longer breaks element loading for the rest of the page's lifetime — the next call retries, while concurrent calls still share one in-flight import.

Breaking: the `DEFAULT_INTERACTION_TAGS` export is removed. It was a hand-copied list of the tags the register module defines, used only for a `customElements.whenDefined` wait — a drifted entry never settled and hung the loader forever. The register module registers every element synchronously during its import, so the loader now resolves once that import resolves and keeps no second inventory.
