---
"@pie-qti/pie-to-qti2": patch
"@pie-qti/source-profiles": patch
"@pie-qti/to-pie": patch
"@pie-qti/transform-cli": patch
"@pie-qti/transform-core": patch
"@pie-qti/transform-types": patch
---

The transformation packages join the 1.0 beta line: every publishable `@pie-qti/*` package now releases at one version, so these move from `0.2.x` to `1.0.0-beta.5` and publish under the `beta` dist-tag with the players. Hosts that pin them exactly need the new version; a `^0.2` range does not pick it up.
