---
'@pie-qti/item-player': patch
---

Implement `templateDeclaration@paramVariable` (QTI 2.2; QTI 3.0 `param-variable`): a `<param>` inside an `<object>` whose `value` names a template variable declared with `paramVariable="true"` is delivered with the variable's current value in place of the variable's name, so a plugin-style object receives its computed parameter instead of the literal variable name. The substitution resolves in the item content pass — the same pass as `printedVariable` — so the delivered parameter tracks `setTemplateVariables`, `newTemplate` and session restore without re-parsing the item. A param value naming an undeclared variable, a declaration without the flag, or a NULL/container variable delivers the authored value unchanged (the spec is silent on those; the literal is the safe reading).
