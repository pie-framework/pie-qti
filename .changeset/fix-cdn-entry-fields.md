---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
---

`@pie-qti/default-components` and `@pie-qti/item-player` no longer declare `unpkg` and `jsdelivr` fields. The fields pointed CDNs at `dist/plugins.js` and `dist/element.js`, which import other `@pie-qti/*` packages by bare name and so never ran when a CDN served the raw file. Both package READMEs (the first one for `@pie-qti/default-components`) now have a "Loading from a CDN" note: use a bundler, an import map, or jsDelivr's `/+esm` endpoint, which rewrites bare imports. For a page without a build step, `@pie-qti/player-elements` is the turnkey option: its `register` entry is self-contained and keeps its CDN fields.

**Breaking: the bare CDN URLs of these two packages no longer serve their custom-element entry** (beta prerelease). `https://unpkg.com/@pie-qti/default-components` and `https://unpkg.com/@pie-qti/item-player`, and the matching `cdn.jsdelivr.net/npm/` URLs, now fall back to each package's `main` entry, `dist/index.js`, instead of `dist/plugins.js` and `dist/element.js`. Neither URL ever worked standalone. Request the file you need by its path and resolve its imports with an import map, or use `/+esm`.
