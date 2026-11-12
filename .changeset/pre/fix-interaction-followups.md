---
'@pie-qti/default-components': patch
---

Follow-up accessibility and behavior fixes for the choice, hottext, slider, match and order interactions:

- **Instance-unique ids**: element ids are now unique per component instance (`$props.id()`), so several interactions, or two renderings of the same item, can share a document without cross-labelling. This covers the match column headings (used by structured labels) and keyboard instructions, the sortable-list instructions, the choice prompt, choice text and elimination-verb ids, the slider prompt and tick list, and the hottext name parts. The choice radio group `name` is unique per instance too, so answering one rendering no longer unchecks the other's radio.
- **hottext**: with `maxChoices=1`, selecting another hottext now replaces the current selection (radio-like, as in `choiceInteraction`) instead of being refused; unselected hottexts keep their selectable cue, and the default selection-limit message is shown only when a selection can actually be refused (`maxChoices>1`). Activating a selected hottext still deselects it, and a selection refused at the `maxChoices>1` cap no longer emits an unchanged `qti-change`.
- **order / sortable lists**: the deprecated `aria-grabbed` is no longer emitted; grab state stays exposed through the item description ("Grabbed. Use arrow keys to move."), `data-grabbed` and the live announcements.
- **Accessible text**: `aria-hidden` content is skipped before its own alternative is read, so a hidden icon carrying `alt` or a `<title>` beside the same visible word no longer doubles the announcement ("Close Close").
