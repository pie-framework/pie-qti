---
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Item rendering and accessibility fixes in the item player.

- **Interactions render where they were authored.** The item body is an ordered content model: a choice between "Part A" and "Part B" text, an extended text followed by more text, interactions inside layout rows and columns or table cells now all render at their authored position instead of after the body. `session.present().flow` is now one `html` node holding the whole item body followed by the interaction mounts in document order; each interaction's element is replaced by an empty slot (`<span data-qti-interaction-slot="…">`, `INTERACTION_SLOT_ATTRIBUTE`) and every mount names its `slot`. Hosts that render the flow themselves mount each interaction into its slot (a mount whose `slot` is `null` renders after the body). Interactions stay mounted across response changes, and when feedback appears after response processing they are moved into the re-rendered body rather than remounted.
- **Paragraphs stay paragraphs.** A paragraph containing inline interactions renders as one paragraph again, and consecutive paragraphs no longer run together (the `p { display: inline }` rule that applied to every item body is gone).
- **Modal feedback is a real modal.** It opens with `showModal()` (the page behind it is inert), focus moves to the feedback title, Escape and a backdrop click close it, and focus returns to the control that opened it — or to the player when that control is now disabled.
- **Inline blanks no longer expose response identifiers.** Text entries and inline choices are named by their authored label (`aria-labelledby`, `aria-label`, `title`) or by their position ("Blank 2 of 4"), and described by the sentence they sit in. Identifiers such as `RESPONSE_3` could hint at answers to screen-reader users only.
- **Text entry:** a pattern mismatch says the answer is not in the expected format (naming the item's placeholder format when it has one) instead of exposing the pattern-mask regular expression in a tooltip; no spellcheck, autocorrect, autocapitalize or autocomplete help; a numeric keyboard (`inputmode`) for integer and float responses. Error text, control borders and focus rings meet WCAG AA contrast.
- **End attempt:** activating an `endAttemptInteraction` ends the attempt — the standalone player submits with the interaction's `countAttempt`, so a hint button (`countAttempt="false"`) runs response processing without using up an attempt. QTI 3.0 `count-attempt` is now read.
- The player's error banner is announced (`role="alert"`), and without an i18n provider every player string falls back to English rather than showing a catalog key.
- New catalog keys `interactions.inline.blankLabel`, `patternMismatch`, `patternMismatchWithHint`, `correctChoice` and `feedback.title` in every locale; the identifier-based `interactions.inline.textEntryLabel`, `choiceLabel` and `formatHint` are removed.
