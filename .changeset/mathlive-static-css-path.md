---
'@pie-qti/item-player': patch
---

Fix the MathLive stylesheet import in the optional `MathLiveEditor` extension: `mathlive/mathlive-static.css` is not an exported path in `mathlive@0.111.x` (the exports map only exposes `./static.css`), so resolving the extension failed under strict package-exports resolution. Now imports `mathlive/static.css`, matching `@pie-qti/default-components`.
