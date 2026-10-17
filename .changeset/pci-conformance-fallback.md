---
'@pie-qti/item-player': patch
---

PCI conformance evidence and a fallback-loading fix (G-08 phase 3): on a multi-module load's fallback attempt, the entry module's id now rebinds to the authored fallback path, so a fallback declared beside a wrong primary path registers instead of re-fetching the broken path. Clean-room conformance fixtures under `tests/conformance/pci/` drive the full delivery path over real module files — registration, `getInstance` state seeding in QTI variable JSON, `onready`/`ondone`, `getState()` restore, and fallback resolution.
