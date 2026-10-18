---
'@pie-qti/item-player': patch
---

PCI module loading reaches the spec's AMD default resolution (G-08 phase 2): every authored `qti-interaction-module` entry is extracted with its id, multi-module declarations load through a `define`/`require` implementation that wires dependencies by id, and the RequireJS-shaped resolution config is parsed from the authored `primary-configuration` reference or the defined default locations (`modules/module_resolution.js`, then `modules/fallback_module_resolution.js`). The entry module is picked by the `customInteractionTypeIdentifier` tail, falling back to its authored fallback path on failure. Evaluation still goes through the host resolver — the loader decides how dependencies wire up, the resolver still decides whether code runs.
