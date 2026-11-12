---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/section-player': patch
'@pie-qti/i18n': patch
---

Accessibility fixes from the round-4 WCAG 2.2 AA review:

- **Interactions state their minimum requirement** (WCAG 3.3.2, 3.3.3). Choice, match, associate, order, gap match, hotspot and graphic order interactions show a visible hint while the response is below its authored minimum (`minChoices`, `minAssociations`, a choice's `matchMin` in match, associate and gap match), the same minimums response validation enforces before an answer counts as complete. The author's `data-min-selections-message` wins over the localized default ("Select at least 2 answers.", "Needs more associations: Red.", "Still to place in the blanks: blue and green."). The hint describes the answer group (`aria-describedby`), draws in `--pie-qti-warning-text`, and is announced politely once when a change leaves the minimum unmet, not on every change. It shows only while the candidate can answer: not when the interaction is disabled or rendered for another role.
- `@pie-qti/item-player` delivers `minSelectionsMessage` for order and associate interactions, also reads the QTI 3.0 `data-min-selections-message` on match interactions, and extracts graphic order `minChoices` (with its message), which response validation now enforces. `GapMatchInteractionData` choices carry `matchMin`.
- New `interactions.*` catalog keys in every locale: `choice.minChoicesHint`, `match.minAssociationsHint`, `match.minChoiceUsesHint`, `associate.minAssociationsHint`, `associate.minChoiceUsesHint`, `order.minChoicesHint`, `graphicOrder.minChoicesHint`, `hotspot.minChoicesHint` and `gapMatch.minPlacementsHint`.
- **PNP inverted polarity no longer inverts a forced-colours palette**: under `@media (forced-colors: active)` the inversion filter is off, so Windows high contrast keeps the colours the candidate chose.
- **A proctor pause keeps a typed math expression**: the math dialog reports a host close as an interrupted cancel with the LaTeX typed so far, and the rich-text editor offers it again in its next insert dialog. The draft is session-only and per response field; inserting the math or the candidate's own cancel discards it.
- **Nested languages in section content**: an `xml:lang` inside test feedback, instructions or rubrics now renders as HTML `lang` (with `dir` where the direction changes), as in passages (WCAG 3.1.2).
