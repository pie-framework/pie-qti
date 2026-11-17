---
'@pie-qti/item-player': patch
---

QTI 3.0 portable custom interactions now receive their `data-*` attributes as `configuration.properties`, keyed by their `HTMLElement.dataset` names (`data-display-format` becomes `displayFormat`). The non-schema `qti-pci-properties` child is still read, and a `data-*` attribute wins when both set a key.
