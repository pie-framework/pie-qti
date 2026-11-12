---
'@pie-qti/i18n': patch
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
---

Follow-up fixes for i18n fallbacks, instance-unique ids, position-object placement, and the associate remove control:

- **i18n fallbacks**: a missing key's default is now interpolated exactly like a translated message (one shared interpolation, including the locale's digits), so candidates no longer see literal text such as "Blank {index} of {count}". `translatePlural` falls back to its English forms when no catalog carries the plural group, instead of returning the raw key (`some.group.other`). `translate` also fills a default that a host `I18nProvider` hands back verbatim, and without a provider a nullish value leaves its placeholder visible rather than printing "undefined".
- **Instance-unique ids**: the match prompt id (`qti-match-prompt-<responseId>`, which crossed each group's `aria-labelledby` between two renderings of the same item) and the associate helper id now come from the component instance. Associate choices no longer reference the helper while it is hidden for correct answers.
- **positionObjectInteraction**: the QTI `centerPoint` attribute is now honoured. It is extracted as an `{ x, y }` offset from the object image's top-left (`PositionObjectInteractionData.centerPoint: PositionObjectCenterPoint | null`, where `null` is the spec default, the centre of the object's bounding rectangle) from every spelling: `centerPoint` (QTI 2.2), `centrePoint` (QTI 2.1), `center-point` (QTI 3.0) and `centre-point` (a converted QTI 2.1 item). The component places and drags objects by that point, for pointer, touch and keyboard placement alike, so it sits on the recorded response point. This replaces the earlier `centerPoint: boolean`; a host passing the boolean in hand-built JSON gets the default centre placement, and the former top-left placement of `false` is now written `{ x: 0, y: 0 }`.
- **associate**: the pair-remove button no longer relies on DaisyUI `btn` classes and carries its own 44×44 CSS px target, and after a pair is removed focus stays in the pair list (the pair that moved into the removed row, or the first choice when none remain) instead of dropping to the document. Unpaired choices no longer have the word "false" as their screen-reader description.
