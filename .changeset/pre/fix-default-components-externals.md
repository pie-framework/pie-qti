---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
---

Hosts now load one shared copy of the item player and the shared packages, instead of a private copy inside the components bundle.

- **`@pie-qti/default-components/plugins`** no longer bundles its own copy of `@pie-qti/item-player`, `@pie-qti/i18n` (including seven locale catalogs) and `@pie-qti/qti-common`, or the `node-html-parser`, `@xmldom/xmldom` and `decimal.js` code they pulled in. It now imports them as the declared dependencies they already were, so the host's bundler resolves each one once. `dist/plugins.js` drops from 1.88 MB to 1.42 MB (gzip: 491 KB to 353 KB). The Svelte runtime, tiptap/KaTeX and mathlive are still bundled, and importing the entry still registers all 21 interaction custom elements.
- **`@pie-qti/item-player/element` and `/element-class`** now import the item player's own modules from the package, instead of carrying a second copy. A page that uses both the root entry and the element now runs a single `Player`, `ItemSession` and PCI registry. The element chunk drops from 370 KB to 122 KB. It still bundles the Svelte runtime, so it works without a host Svelte.
- **`@pie-qti/player-elements`** contains one copy of the item player core instead of two. Its JavaScript drops from 10.76 MB to 9.69 MB in total (gzip: 2.67 MB to 2.39 MB), and `register.js` drops from 1.87 MB to 1.41 MB.

**Breaking: `@pie-qti/default-components/plugins` is no longer self-contained** (beta prerelease). Hosts that build with a bundler need no change. Loading `dist/plugins.js` directly in a browser, as the package's `unpkg` and `jsdelivr` entry does, now needs an import map, or an ESM CDN that rewrites bare imports, for the `@pie-qti/*` packages it imports and their dependencies. `@pie-qti/item-player/element` already works this way.
