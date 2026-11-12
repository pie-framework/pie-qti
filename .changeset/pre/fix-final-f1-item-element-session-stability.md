---
'@pie-qti/item-player': patch
'@pie-qti/player-elements': patch
'@pie-qti/i18n': patch
---

The standalone item player no longer destroys the candidate's attempt state when a host writes a property on it (final-review findings F1, F3, F7, F10, F11).

**Breaking:**

- Standalone delivery now hides integrated feedback (`feedbackInline` / `feedbackBlock`) unless the host opts in, as QTI `itemSessionControl@showFeedback` (default `false`) requires. Hosts that relied on the old always-show behaviour pass `showFeedback: true` (property or `show-feedback` attribute); `showSolution` / `show-solution` opts into correct responses after the attempt ends. An injected `session` keeps its own presentation policy.
- The `<pie-qti-item-player>` role attribute is renamed to `qti-role`: a bare `role` attribute is the ARIA role, and writing a QTI view name there put an invalid ARIA token on host pages (axe `aria-roles`). The `role` JS property keeps working; unknown `qti-role` values now render as `candidate` with a diagnostic instead of silently going read-only.

**Fixed:**

- Any property write on a mounted item element — a response write, a no-op `disabled` write, a section composition re-assign — used to re-create the item's owned `AssessmentItemDefinition` + `ItemSession`, re-rolling `shuffle` choices mid-answer, re-randomizing template values, wiping submitted modal feedback and resetting adaptive `numAttempts`. The session now re-opens only when a definition-fixed input (`itemXml`, `qti-role`, `security`, `pnp`, `deliveryContext`, `pci`, `stringComparison`, `plugins`, `showFeedback`, `showSolution`) truly changes; `disabled`, `i18n`, `typeset`, `responses` and no-op writes never re-open, and a re-open of the same item replays the same template-processing seed.
- The element keeps the session it owns across a detach and adopts it again on reattach, so re-parenting the element (framework re-orders, layout moves) resumes the attempt instead of restarting the item.
- Re-using the element across items no longer fails hard on stale `responses`: values the new item declares carry over, the rest are dropped with a diagnostic (`UnknownResponseIdentifierError` is exported for hosts that want to detect it).
- A broken item dispatches a typed, bubbling `error` event with detail `{ code, message, itemIdentifier? }` (`item-load-failed`, `response-processing-failed`, `submission-failed`, `render-failed`) and renders a localized generic candidate message instead of the raw parser/engine string; the raw detail goes to the host event only. `ready` now fires only on success, once per successful mount. **Breaking:** hosts that listened for `ready` on broken items receive `error` instead.
- The item element's attribute list is now documented accurately in `@pie-qti/player-elements`' README, including the attribute-backed `locale` and the fact that `showSubmit` stays `false` (hosts call `submit()`).
- `item.submitError` ships in all eight locales for the candidate-facing submission-failure message.
