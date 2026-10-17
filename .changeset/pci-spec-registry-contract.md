---
'@pie-qti/item-player': patch
---

PCI adopts the QTI 3.0 §6.1 registry contract (G-08 phase 1), replacing the bespoke `PciModule` interface outright: modules register against the page's `qtiCustomInteractionContext` and the host instantiates through `getInstance(dom, configuration, state)` with `onready`/`ondone`, a derived `status` (`interacting`/`closed`/`solution`/`review`), and QTI variable JSON (`base`/`list`/`record`) at the boundary. Responses are owned by the mounted module — `restore()` re-seeds `getInstance` state instead of pushing a setter — and `getState()` is exposed on the host. Host resolver trust gating is unchanged. A module written against the retired `PciModule` breaks; none is known to exist.
