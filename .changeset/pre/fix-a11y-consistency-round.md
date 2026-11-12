---
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
'@pie-qti/item-player': patch
---

Interaction controls now expose their state once, through their ARIA state, and controls with the same function share one name.

- **Single-select hotspot is a radio group** (WCAG 4.1.2). With `maxChoices=1` the hotspot overlay is a `role="radiogroup"` (named by the prompt) of `role="radio"` regions with `aria-checked`, like the single-select hottext and `choiceInteraction`'s radios: one Tab stop (roving tabindex), arrow keys that move to the next or previous region and check it (mirrored under RTL), Space and Enter to check, and no unchecking by clicking, tapping or pressing the checked region again. A "Clear answer" button, the same control and name as in `choiceInteraction` and hottext, retracts the answer. Disabled regions carry `aria-disabled`. Multiple selection keeps `aria-pressed` toggle buttons.
- **No state words in accessible names** (WCAG 4.1.2). Hottext spans are named by their content alone; the "Selected"/"Selectable" word that repeated `aria-checked`/`aria-pressed` is gone, and an empty `<hottext>` is named by its position ("Choice 2"). The elimination toggles of `choiceInteraction` and `orderInteraction` keep the name "Eliminate {choice}" when pressed, instead of flipping to "Restore {choice}". An order item with nothing to read is named by its position instead of its identifier. Graphic-gap-match palette labels keep their own name when picked up or placed; the pick-up and place hint is now their description. A position-object palette object no longer adds "Selected for placement." to its name.
- **Select point's clear control reads "Clear answer"** (WCAG 3.2.4), the name the other interactions use for that control, instead of "Clear All".
- **No invented expected length for the extended-text counter.** An absent `expectedLength` stays absent: it is a hint with no default in any QTI version. `ExtendedTextInteractionData.expectedLength` is now optional. Without an authored length, `qti-counter-up` and `qti-counter-down` show no counter instead of counting against 200.

**Breaking: locale keys removed** (beta prerelease). `interactions.hottext.selectedState`, `interactions.hottext.selectableState`, `interactions.choice.restoreChoice`, `interactions.order.restoreItem` and `interactions.graphicGapMatch.selectedHint` have no use left and are removed from all locales. `interactions.graphicGapMatch.heldHint` drops its leading "Picked up." sentence. Hosts that override these keys in a custom catalog can drop the overrides.
