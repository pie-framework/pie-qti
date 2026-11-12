---
'@pie-qti/assessment-player': patch
---

**Breaking: `NavigationManager` is no longer exported from `@pie-qti/assessment-player`** (beta prerelease). The class is internal machinery of `AssessmentPlayer` (visited-item tracking) and was never meant for hosts; nothing in the repo imported it from the package entry, and the package's exports map (`.` and `./integration`) makes `core/index.ts` unreachable from outside. The class itself stays and `AssessmentPlayer` still uses it; hosts must navigate through `AssessmentPlayer` (`next()`, `previous()`, `goTo()`, `canNavigateByTestPart()`). Hosts that (against the docs) imported `NavigationManager` directly must switch to the player API.
