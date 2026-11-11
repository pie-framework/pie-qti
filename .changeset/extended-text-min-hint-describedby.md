---
'@pie-qti/default-components': patch
---

Extended-text names the minimum-strings hint in each response field's `aria-describedby` while it shows (WCAG 1.3.1, 3.3.2), per `MinimumRequirementHint`'s documented contract and like every other consumer: a field's description is its character counter, then its pattern-mask message while the text fails the mask, then the hint while the response holds fewer than `minStrings` filled fields — wiring both the plain textareas and the rich-text editor fields. Previously the hint rendered and announced but no field described it, so a screen-reader user focused in a field met the requirement only through the one-time announcement or in reading order, never as the field's own description; the description now appears with the hint and drops with it (when the minimum is met no description id remains).
