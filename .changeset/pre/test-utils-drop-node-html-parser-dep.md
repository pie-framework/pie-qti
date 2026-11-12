---
'@pie-qti/test-utils': patch
---

Stop installing `node-html-parser` for consumers: the package's dist never imports it (only its own test suite does), so it moves from dependencies to devDependencies and no longer lands in `npm install @pie-qti/test-utils` trees.
