---
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
'@pie-qti/item-player': patch
---

Validation feedback where the candidate answers.

- **Extended text says when a response does not match its `patternMask`** (WCAG 3.3.1). A string response that fails the mask is invalid under `validateResponses` (QTI 2.1; QTI 3.0 §5.48.4); the field now says so. When the candidate leaves a field (plain text or rich text) whose text fails the mask, the author's `data-patternmask-message` shows below it, else the new localized `interactions.extendedText.patternMismatch` sentence. The message describes the field (`aria-describedby`), the field states `aria-invalid="true"`, and the message is announced once through the interaction's polite live region; it clears as soon as the text matches and never blocks typing. The mask is compiled with the player's own XSD translation (`xsdPatternToRegExp`) and tested against the text the response holds, so the message and validation agree: an empty field and a numeric response are never flagged. Each field of a multi-part response is checked on its own. `@pie-qti/default-components` now depends on `@pie-qti/qti-processing` for that translation.
- **The extended-text extractor reads the QTI 3 `data-patternmask-message`.** It read a `patternMaskMessage` attribute that no QTI version defines, so `ExtendedTextInteractionData.patternMaskMessage` was never set from authored content; it now reads `data-patternmask-message` (QTI 3.0 `qti-extended-text-interaction`; QTI 2.x has no equivalent), as the text entry extractor does.
