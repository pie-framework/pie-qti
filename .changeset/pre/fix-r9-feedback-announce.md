---
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Integrated feedback (`feedbackInline` / `feedbackBlock`) shown after an attempt is now announced to assistive technology (WCAG 4.1.3 Status Messages). The attempt splices the feedback into the item body without moving focus, so screen-reader users previously heard nothing when feedback appeared.

- The item body renders one persistent, visually hidden polite live region (`.qti-feedback-announcer`, `role="status"`). It is in the DOM from the item's first render, so every player integration announces through it: `ItemPlayer`, the `<pie-qti-item-player>` custom element (used by the section player's item renderer and the assessment player), and any host rendering `ItemBody` directly.
- Announcements fire when the candidate's own attempt ends — a submit or end-attempt, covering every attempt of an adaptive item — and announce the accessible text of the feedback now shown, in document order, including image `alt` text. Feedback shown again by a new attempt is announced again (the live region toggles a zero-width space, the pattern the interactions use for refusals). Initial render, restore, review and scorer views, and unrelated re-renders such as a response change, never announce.
- The announcement carries the item content's `lang` and `dir` (WCAG 3.1.2); when the shown feedback has no text, such as an image with no alt, a localized "Feedback is shown." is announced in the interface language instead. The new `feedback.shown` key ships in all eight locales (ar, en, es, fr, nl, ro, th, zh-Hans).
- Custom renderers can read the same data from `ItemPresentation.shownFeedback` (`{ shown, text }`), newly reported by the presentation plan.
