---
'@pie-qti/typeset-katex': patch
---

Declare the `./css` entry as a side effect. The `@pie-qti/typeset-katex/css` export exists solely to pull in `katex/dist/katex.min.css`, but the package previously declared `"sideEffects": false`, licensing bundlers to tree-shake away the very module the export provides. CSS imported through `@pie-qti/typeset-katex/css` is now preserved.
