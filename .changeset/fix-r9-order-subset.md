---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Order and graphic-order interactions can now ask for a ranked subset ("rank your top 2 of 5"), as QTI 2.2 §5.73 / §5.42 and QTI 3.0 `min-choices` / `max-choices` define. Before, every choice always had to be ordered, so such an item could never be answered correctly; a vertical slider is also now announced as vertical.

- **orderInteraction / graphicOrderInteraction**: when `minChoices` is set and is below the number of choices, the candidate chooses which choices to order. The interaction shows two labelled lists, "Your order" and "Not in your order"; the second holds the remaining choices, without position numbers. The candidate moves items between them with **Add** and **Remove** controls and orders them as before (drag, touch, Space/Enter grab with arrow keys, or the move buttons).
  - The response is the ordered subset, or `null` while nothing is ordered. A saved subset response is restored in sequence.
  - Adding past `maxChoices`, clamped to the number of choices, is refused, and the refusal is announced. The limits are stated up front ("Choose 2 items and put them in order." or "Choose between 1 and 3 items…"). The author's `data-min-selections-message` replaces that text when given.
  - Add, remove and refusal are announced through a polite live region; a repeated refusal is announced again.
  - Focus follows the moved item. The controls are at least 44×44 CSS px, and a row's controls wrap below the item on narrow screens. The layout mirrors under right-to-left text and keeps a visible state under forced colors.
  - Subset mode has no "Confirm Order" step: every ordered item was added deliberately and can still be removed.
  - The scorer view lists the authored correct subset under "Correct order".
  - Without `minChoices`, or with `minChoices` at or above the number of choices, the interaction is unchanged: all choices are ordered and `maxChoices` is ignored, as the spec requires.
- **item-player**: graphicOrderInteraction now reads `maxChoices`. A new `orderChoiceLimits` export carries the subset rule the renderers and response validation share. `validateResponses` rejects an order or graphic-order response longer than the subset cap. Once an order has begun, it is complete only when it reaches its minimum: every choice when no subset is requested (a partial order used to pass as complete), and `minChoices` when one is. An untouched order is still a skip.
- **sliderInteraction**: a vertical slider (`orientation="vertical"`) now carries `aria-orientation="vertical"`. Before, it was turned only through CSS, so screen readers announced it as horizontal (WCAG 4.1.2).
- **i18n**: new keys in all 8 locales. Under `interactions.order`: `yourOrder`, `notInOrder`, `emptyOrder`, `addItem`, `removeItem`, `itemAdded`, `itemRemoved`, `orderLimitReached` (plural), `correctOrder`, `subsetExactHint` and `subsetRangeHint` (plurals). Under `interactions.graphicOrder`: `subsetExactHint` and `subsetRangeHint`.
