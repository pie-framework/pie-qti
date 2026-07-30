---
'@pie-qti/assessment-player': patch
'@pie-qti/assessment-toolkit': patch
'@pie-qti/default-components': patch
'@pie-qti/demo-vendor-extensions': patch
'@pie-qti/element-schemas': patch
'@pie-qti/i18n': patch
'@pie-qti/ims-cp-browser': patch
'@pie-qti/ims-cp-core': patch
'@pie-qti/ims-cp-node': patch
'@pie-qti/item-player': patch
'@pie-qti/logger': patch
'@pie-qti/pie-to-qti2': patch
'@pie-qti/player-elements': patch
'@pie-qti/qti-common': patch
'@pie-qti/qti-processing': patch
'@pie-qti/section-player': patch
'@pie-qti/source-profiles': patch
'@pie-qti/storage': patch
'@pie-qti/test-utils': patch
'@pie-qti/theme': patch
'@pie-qti/theme-daisyui': patch
'@pie-qti/to-pie': patch
'@pie-qti/transform-cli': patch
'@pie-qti/transform-core': patch
'@pie-qti/transform-types': patch
'@pie-qti/typeset-katex': patch
'@pie-qti/web-component-loaders': patch
---

Normalize `repository.url` to the `git+https://` form.

npm was rewriting this field at publish time and warning about it:

```
npm warn publish "repository.url" was normalized to "git+https://github.com/pie-framework/pie-qti.git"
```

Beyond silencing that warning, npm requires `repository.url` to match the GitHub
repository exactly when generating provenance attestations, so this is a prerequisite
for moving publishing to trusted publishing (OIDC). No runtime or API change.
