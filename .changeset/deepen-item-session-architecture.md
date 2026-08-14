---
'@pie-qti/assessment-player': patch
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
'@pie-qti/qti-common': patch
'@pie-qti/section-player': patch
---

Introduce immutable assessment-item definitions and one authoritative live `ItemSession` across
assessment, section, custom-element, and standalone rendering. Finalize item-body and interaction
content at their delivery boundaries, seal definition-time extension registries, and expose typed,
immutable presentation and session contracts.

This intentionally changes the assessment-to-section composition API, the player-element session
property, and item-player plugin/presentation contracts. Obsolete snapshot-driven assessment
rendering component exports are removed. Direct `Player` and managed lifecycle compatibility
entries are removed; consumers migrate to the definition/session interface. Server scoring uses the
DOM-free `createAssessmentItemDefinition()` export from
`@pie-qti/item-player/server` and dispatches item-session commands. Item-player custom elements now
publish notifications only through typed DOM events, and standard extractor implementations and
refactor-era interaction compatibility barrels are no longer part of the package interface.
