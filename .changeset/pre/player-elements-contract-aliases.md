---
'@pie-qti/player-elements': patch
---

The public declaration facade (`QtiSecureAssessment`, `QtiAssessmentBackend`, `QtiScoringResult`, `QtiPlayerSecurityConfig`, `QtiSerializedItemSessionState`, and 22 more) is now composed of type aliases of the upstream contracts in `@pie-qti/assessment-player` and `@pie-qti/item-player` instead of 928 lines of hand-copied mirrors, so the facade can no longer drift from the real backend/player contracts — upstream field additions flow through automatically. Notable alignment: `QtiAssessmentRubricBlock.view` is now `string[]` (authored QTI view tokens), matching the upstream contract, and the backend facade carries upstream's optional `comment`, `branchRule`, `keepTogether`, `variableMappings`, and `templateDefaults` fields. Deliberately hand-written shapes (the element event maps, element classes, PCI/module policy callbacks, processing-fragment runtime, and the resolved-delivery-context composites) are documented as such in the source.
