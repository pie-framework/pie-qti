---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Fix accessibility and QTI compliance in the drag/association interactions.

- Rich choice content no longer collapses into a flattened `aria-label`: sortable, match and associate controls are named with `aria-labelledby` pointing at the rendered content, so image `alt` and MathML `alttext` participate in the name. Position/state sentences ("Position 2 of 4", "Matched with …", "Selected") moved to `aria-describedby` targets, and live announcements use a new `accessibleTextFromHtml` walker that reads image alt, MathML alttext and SVG titles instead of raw `textContent` (WCAG 1.1.1/4.1.2).
- Raw QTI identifiers no longer leak into accessible names: associate choices drop the "A_choice_2: Paris" prefix and gap-match blanks are named with localized ordinals ("Blank 2 of 4") instead of the gap identifier, which could reveal answers to screen-reader users.
- `gapMatchInteraction` now supports `gapImg` (QTI 2.x `gapImg` with `<object>`, QTI 3.0 `qti-gap-img` with `<img>`/`<object>`): image choices are extracted into the pool with alt text and matchMax/matchGroup, rendered as image tiles in the palette and inside filled gaps, and validation accepts an image-only item instead of erroring "must have at least one gapText".
- Contrast and target-size fixes (WCAG 1.4.11/2.5.8): empty gap-match blanks and match drop zones use a 3:1 boundary (`--pie-qti-border-strong`), the gap-match focus ring is solid `--pie-qti-focus` without alpha, the held-word cue uses `--pie-qti-border-strong`, the match clear button, gap-match remove buttons and blanks are 44px targets, and the match max-selections message uses the warning text token for 4.5:1 text contrast.
- Order interaction: the elimination toggles now render inside their item's row (aligned at any row height), and move/eliminate buttons are named for their item ("Move Paris later", "Eliminate Paris"), including image alt from rich item content.
- Escape now cancels a held word (gap-match) or selected source (match), announces the cancellation and returns focus to the item.
