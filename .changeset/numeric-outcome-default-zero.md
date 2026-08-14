---
'@pie-qti/item-player': patch
'@pie-qti/qti-processing': patch
---

Initialize numeric outcome variables to 0 when no default is declared. Per QTI 2.1 §5.2, carried
into 2.2 and 3.0, an outcome with no `<defaultValue>` initializes to NULL unless its base type is
`integer` or `float`, where it initializes to 0. Every defaultless outcome was initialized to NULL,
so accumulating response processing such as `SCORE = sum(SCORE, 1)` propagated NULL and the item
never scored: 1EdTech acceptance criteria Q12-L2-D3/D4/D5 require `SCORE` of 1, 0 and 2 for the
composite inline-choice sample, and pie-qti returned NULL for every response set. The rule is
applied at parse time, so it also governs the reset before each response-processing run and the
`<default>` expression. Response and template variables are unaffected — an unanswered numeric
response must stay distinguishable from an answered zero — and an authored `<defaultValue>` still
wins. `@pie-qti/assessment-player` already applied this rule to test-level declarations; item and
test level now agree.

A `MAXSCORE` declared without a default is consequently 0 rather than absent, so an item that never
assigns it scores against a maximum of zero. Substituting 1 inside response processing would make
this engine disagree with a conformant one, so the value stands and the player warns once per item,
naming the item and the remedy. `ScoringResult.maxScore` still falls back to `1.0` when `MAXSCORE`
is not declared at all, which the spec leaves open.

`Declaration` gains `impliedNumericDefault`, marking a `defaultValue` that came from this rule
rather than from the author.

Remove the unused `core/declarations.js` exports (`initializeDeclarations`, `addDeclaration`,
`addMapping`, `addAreaMapping`, `getVariableValue`, `setVariableValue`, `resetDeclarations`,
`cloneDeclarations`, `DeclarationsContext`) and `BUILTIN_DECLARATIONS`. Nothing in the framework
called them; they were a second declaration model that took no response/outcome kind, so they could
not carry the numeric-outcome rule and would have kept returning NULL defaults. `BUILTIN_DECLARATIONS`
also described built-ins the runtime does not use and typed `completionStatus` as `string` where the
runtime seeds `identifier`. Hosts that built declaration maps by hand should use
`createAssessmentItemDefinition()` and the session interface instead.
