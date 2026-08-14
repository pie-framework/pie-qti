---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
'@pie-qti/section-player': patch
---

Keep integer arithmetic integer-typed in processing. Per QTI 2.2 `sum`, `subtract`, `product`,
`max` and `min` yield an integer when every sub-expression is an integer, and a variable holds
values of its declared base-type. Both were widened to float, and because `match` is base-type
strict, a template variable such as `ANSWER = sum(A, B)` declared `baseType="integer"` stopped
matching an integer `RESPONSE` — a correct answer scored 0. Assignments now conform to the
declaration's numeric base-type; a fractional value assigned to an integer declaration is left
alone so the authoring error still surfaces.

Hide `positionObjectStage` from the item body. The stage owns the background object and wraps its
interactions, all of which the component renders, so matching only the interaction inside it left
the background image drawn a second time above the interaction.

Stop the rich-text editor reporting editability changes as content edits. Tiptap's
`setEditable(editable, emitUpdate = true)` emits `update` with an empty transaction, so toggling
`editable` looked like a learner edit to the host; `onUpdate` now requires `transaction.docChanged`
and the editability sync passes `emitUpdate: false`.

Pin the `@pie-players/*` toolkit dependencies to one version. They share a `pie-context`
singleton, so bumping a single member installs two copies and the section player's toolbar icons
stop resolving. Moving the set to 0.3.65 additionally needs code changes, as it no longer exports
`createPackagedToolRegistry`.
