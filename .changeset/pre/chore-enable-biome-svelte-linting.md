---
'@pie-qti/default-components': patch
---

No functional changes: repository linting now covers Svelte files (the linter previously skipped every `.svelte` file entirely). Mechanical cleanup in `position-object` and `select-point` interactions uses `Number.isNaN` instead of the global `isNaN` on values that are already numbers.
