---
'@pie-qti/player-elements': patch
'@pie-qti/assessment-player': patch
'@pie-qti/section-player': patch
'@pie-qti/i18n': patch
---

The assessment shell and section player no longer require DaisyUI or Tailwind on the host page.

- **Self-contained styling**: the shell (`<pie-qti-assessment-player>`) and section players (`<pie-qti-section-player-splitpane>`, `<pie-qti-section-player-vertical>`) style themselves with scoped CSS on the `--pie-qti-*` tokens, with fallbacks when no theme is loaded. Icons are sized by the components, buttons are ≥44px with visible 2px focus rings, and alerts, spinners, the splitter and test feedback no longer read DaisyUI `--color-*` variables. Existing class names and `data-testid` hooks are kept.
- **Layout**: the shell fills its host container instead of a fixed `100vh` box (`--pie-qti-assessment-min-block-size` / `--pie-qti-assessment-max-block-size` tune the bounds when the host gives no height). A new `full-viewport` attribute (`fullViewport` property) fills the dynamic viewport with safe-area insets and page-level `header`/`main`/`nav` landmarks. At short viewports (400% zoom, landscape phones) everything flows in one scroll and no bar is pinned over the content.
- **Phones**: navigation is one compact row (Previous, position, Next/Submit), nested gutters collapse to one slim gutter, and a passage shares the screen with the question through an accessible Passage/Question tab switch instead of a 40%-height scroll box. Wide screens keep the keyboard-resizable splitter.
- **Accessibility**: a "Skip to question" link, a region named by the assessment title, a labelled navigation landmark, Previous/Next arrows mirrored right-to-left, and navigation buttons that keep focus while a transition is in flight.
- **Polish**: the header shows the assessmentTest `title` (or a localized generic title), never the identifier; untitled sections no longer read "Section 2 of 0"; passages are headed by their `title` or a neutral localized "Passage" label at a heading level that fits the outline (`heading-level` attribute on the assessment and section elements). Item load failures show a localized message instead of the raw error.
- **Host CSS**: a low-priority `@layer pie-qti-base` restores user-agent defaults (lists, headings, paragraph spacing, link underlines, inline images, bordered tables, media max-width) inside item, passage and rubric content, so host resets no longer strip question stems.
- **APIs**: `AssessmentPlayer.getAssessmentTitle()`; optional `title` on `QtiSharedHtmlBlock`; the reference parser leaves a missing assessmentTest title empty instead of English "Assessment". `@pie-qti/i18n` adds `assessment.skipToQuestion` and a `sectionPlayer` section across all eight locales.
