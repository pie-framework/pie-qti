---
'@pie-qti/item-player': major
---

Declare the player platform's 1.0 feature set complete with a beta: all tracked QTI 2.2 / 3.0 spec gaps are closed — the spec-conformant PCI runtime (registry contract, `getInstance`, QTI variable JSON, AMD loading with resolution configs, clean-room conformance fixtures) plus the opt-in sandboxed execution engine (`@pie-qti/pci-runner`), PNP structured labels and braille data exposure, and manifest-level shared catalog files. The player/platform packages move together to the prerelease line and publish under the `beta` npm dist-tag; `latest` stays on 0.1.x. The transformation packages (`@pie-qti/pie-to-qti2`, `to-pie`, `transform-cli`, `transform-core`, `transform-types`, `source-profiles`) stay pre-alpha on their own 0.1.x lockstep — they only ride along as the patch their dependents' release requires. The final 1.0.0 follows the official-suite evidence refresh and a production-host validation.
