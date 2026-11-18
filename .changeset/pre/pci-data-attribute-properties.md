---
'@pie-qti/item-player': patch
---

QTI 3.0 portable custom interactions now receive their `data-*` attributes as `configuration.properties`, keyed by their `HTMLElement.dataset` names (`data-display-format` becomes `displayFormat`). The `qti-pci-properties` child, which no QTI version defines, is no longer read: move its values to `data-*` attributes.
