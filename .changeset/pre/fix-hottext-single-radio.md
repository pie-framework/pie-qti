---
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
---

**Behavior change: a single-select hottext no longer deselects when the candidate activates the selected word again.** With `maxChoices=1` the hottext spans now work like the radio buttons of a single-choice question. Clicking, tapping, or pressing Enter or Space on the selected span keeps it selected and fires no `qti-change`. Selecting another span still replaces the answer. To retract the answer, the candidate uses the "Clear answer" button. Multi-select hottext (`maxChoices` other than 1) is unchanged: activating a selected span still deselects it, as a checkbox does.

Assistive technology now gets semantics that match this behavior (WCAG 4.1.2). The passage container of a single-select hottext is a `role="radiogroup"` with the same accessible name, and each span is a `role="radio"` with `aria-checked` instead of an `aria-pressed` toggle button. The keyboard follows the WAI-ARIA radio group pattern:

- the group is one Tab stop (the selected span, or the first);
- the arrow keys move to the next or previous span and select it, wrapping at either end, with Left and Right mirrored in right-to-left text;
- arrow keys held with Alt, Ctrl or Meta are left to the browser;
- Space and Enter select the focused span.

The spans stay inline in the text.

The hottext clear button now reads "Clear answer", for single and multiple selection alike, matching the control with the same function in the choice interaction (WCAG 3.2.4). Like that control, it appears only while there is an answer and the interaction is enabled, and after clearing it moves focus to the first hottext span. While disabled, the hottext spans also report `aria-disabled="true"`. The now-unused `interactions.hottext.clearSelection` message is removed from every locale. A host that overrides the button label should use `interactions.choice.clearAnswer`, the key it now shares with the choice interaction.
