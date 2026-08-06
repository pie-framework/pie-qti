---
'@pie-qti/ims-cp-node': patch
---

Treat a backslash in a ZIP entry path as a path separator when extracting.

ZIP requires `/` as the separator, but some Windows producers emit `\`. On POSIX those entries previously extracted to single files whose *names* contained a backslash — `items\q1.xml` instead of `items/q1.xml`. Because `@pie-qti/ims-cp-core` canonicalizes `\` to `/` before resolving hrefs, such a package extracted without error and then had **every resource unresolvable**, which reads as an empty or broken package rather than as an extraction problem.

`extractZipToDirSafe` (and `extractZipToDirStream`, which delegates to it) now normalizes entry separators before resolving the output path, matching what `unzip` does with the same archives. Normalization runs ahead of the traversal checks, so `..\..\escape` and `\absolute` are still rejected.
