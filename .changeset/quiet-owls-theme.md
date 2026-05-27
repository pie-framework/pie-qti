---
"@pie-qti/default-components": minor
"@pie-qti/item-player": minor
"@pie-qti/theme": minor
"@pie-qti/theme-daisyui": minor
"@pie-qti/web-component-loaders": minor
---

Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

`loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

`@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.
