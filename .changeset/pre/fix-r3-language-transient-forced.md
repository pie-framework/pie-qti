---
'@pie-qti/assessment-player': patch
'@pie-qti/assessment-toolkit': patch
'@pie-qti/section-player': patch
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
---

Round-3 accessibility fixes for content language, transient UI on pause, and forced colors:

- **Test-level content keeps its language (WCAG 3.1.2):** the assessmentTest parser now carries
  the authored language of each `testFeedback` and `rubricBlock` (passages, instructions) as an
  optional `language` field: its own `xml:lang` (QTI 3.0 also `lang`, or its
  `qti-content-body`'s), else the enclosing test part's, section's or test's, across an
  `assessmentSectionRef` too; `xml:lang=""` declares none. `TestFeedbackItem`,
  `VisibleTestFeedback` and `AssessmentRubricBlock` gain the optional field,
  `normalizeQtiSharedContext` passes it through as `QtiSharedHtmlBlock.language`, and the section
  player's `TestFeedback` renders it as each block's `lang`/`dir` — in delivery and on the
  completion screen — so screen readers and read-aloud switch to the content's voice while the
  chrome keeps the interface locale. A passage's nested `xml:lang` is now restated as HTML `lang`
  (with `dir` where the direction changes against the passage's own language) even without SSML.
- **Transient UI closes on a proctor pause:** the math-input dialog and glossary/catalog popups
  listen for the host's `pie-qti-close-transient-ui` event on `document` (the assessment shell
  dispatches it with `detail.reason: 'pause'`). The math dialog closes through its cancel path
  (`onCancel`, focus trap released, focus back on its opener) and a request that arrives while
  MathLive is still loading cancels it before it opens; an open popup closes as if dismissed. The
  math dialog's focus trap is re-entrancy-safe: it never re-handles the focus moves it makes, so it
  cannot recurse against another focus containment such as the pause overlay.
- **States survive forced colors (WCAG 1.4.11/1.4.1):** in Windows High Contrast and other
  forced-colors modes the picked-up item of a reorderable list keeps a heavier system `Highlight`
  border (no layout shift), and pressed Bold/Italic toolbar toggles in the rich-text editor take
  the system selection colours. Focus outlines are unchanged.
