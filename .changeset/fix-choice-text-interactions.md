---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Accessibility and usability fixes for the choice, hottext, slider, and end-attempt interactions:

- **choice**: visible keyboard focus on the whole row (including with `qti-input-control-hidden`), a ≥44px row target with a non-color selected state and 1rem base text, container-query reflow for `qti-choices-stacking-N`/horizontal layouts, an always-prompt-named answer group (`aria-labelledby`), a localized refusal message at `maxChoices` when none is authored, a "Clear answer" button for single choice, contrast fixes for the selection message and elimination toggle (44px target), and elimination toggles named from their action plus the choice text.
- **hottext**: accessible names composed via `aria-labelledby` from the rendered content and a localized state word (no hardcoded "Selectable text:" prefix), a visible focus indicator under `qti-input-control-hidden`, a ≥3:1 selectable boundary cue, the localized refusal default at `maxChoices`, and a non-color correct-answer marker (underline plus hidden text) in the scorer view.
- **slider**: the accessible name comes from the prompt (`aria-labelledby`) with `aria-valuetext`; before the first interaction the slider announces and displays "No value selected" in a distinct untouched state instead of presenting the midpoint; `orientation="vertical"`, `reverse`, and `stepLabel` are now rendered.
- **end attempt**: counted attempts require an inline confirmation (focus on confirm, Escape cancels) before the response is emitted; after ending, focus moves to an announced `role="status"` message ("Your attempt has ended."); the accessible name is the visible label; controls use self-contained token styles at ≥44px.
- **item-player**: `SliderInteractionData` now carries the authored `stepLabel` flag; `@pie-qti/i18n` adds candidate-facing strings for these behaviors across all eight locales.
