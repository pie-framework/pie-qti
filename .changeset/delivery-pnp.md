---
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
'@pie-qti/assessment-player': patch
'@pie-qti/section-player': patch
'@pie-qti/player-elements': patch
'@pie-qti/i18n': patch
'@pie-qti/web-component-loaders': patch
---

AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
