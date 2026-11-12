---
'@pie-qti/assessment-player': patch
---

Remove unused public API (verified zero consumers repo-wide): `StatePersistenceManager` and its `PersistableState`/`PersistenceConfig` types (whose state model contradicted the session state the player actually persists — code importing it would have saved the wrong shape), the never-imported `ItemSessionInfo` component, and duplicate `hasAnyResponse`/`shuffleArray` helper copies (the shared implementations are now the single source of truth).
