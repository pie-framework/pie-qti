---
'@pie-qti/default-components': patch
---

Fix incorrect association state in `associate` and `graphic-associate` interactions when choice/hotspot identifiers share a prefix (e.g. `A` and `A1`, `hotspot1` and `hotspot10`). Pair membership was tested with substring matching, so a hotspot could appear "maxed out" and block valid answers, and correct-answer highlighting could misfire. Both interactions now use whole-token matching via the shared pair helpers, which gained tested `pairIncludesId`/`countPairsWithId` utilities.
