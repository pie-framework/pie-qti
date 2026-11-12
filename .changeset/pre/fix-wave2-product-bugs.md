---
'@pie-qti/default-components': patch
---

Three fixes reported by the new accessibility regression tests:

- The math-input dialog's Shift+Tab now moves focus out of the math field to the dialog's controls. MathLive claimed Tab/Shift+Tab for placeholder navigation and swallowed the key even at the field boundary, leaving backward keyboard navigation dead inside the dialog. Tab keeps MathLive's placeholder navigation; Shift+Tab exits backward; forward wrapping uses MathLive's `move-out` event.
- The customInteraction fallback derives its textarea id per instance, so two renderings of the same item on one page no longer share an id and mislabel each other's input.
- The customInteraction fallback receives the interaction's i18n provider, so its candidate-facing text follows the configured language instead of always showing English defaults (its textarea border also meets non-text contrast now).
