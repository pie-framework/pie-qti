---
'@pie-qti/player-elements': patch
---

Clarify the `QtiAssessmentPlayerConfig.rng` documentation: it seeds selection and ordering only in reference/preview mode (built-in reference backend) and is ignored in authoritative-backend delivery, mirroring the deprecated `rng` on the headless assessment-player config. Docs-only change to shipped declarations.
