---
'@pie-qti/item-player': patch
---

Internal restructuring of the item session engine (Phase 6 of the player cleanup): the
`Player` god object is decomposed into focused modules behind the public facade —
`createAssessmentItemDefinition`, `openSession`, `dispatch`, `state()`, `present()`,
`serialize()` — with no behaviour change. Declaration building and value coercion live in
`core/declarations/`, response processing execution and response validation in
`core/processing/` (the validation special cases — media `minPlays`, end-attempt, extended-text
`maxStrings` — are per-type entries keyed on the delivered interaction type; every interaction
keeps the generic field checks), the item content pass and HTML rendering in `core/rendering/`,
session serialization and the duration clock in `core/serialization/`, the per-session PCI host
registry in `pci/sessionHosts.ts`, and the session catalog index and lookup in
`catalog/sessionCatalog.ts`. Response validation is memoized per response revision and
interaction-data generation (the end-attempt gate stays separate; serialized
`validationMessages` never contain `incomplete`), and the extended-text numeric `base` is read
once per interaction identifier instead of re-parsing per coercion. The earliest
`enforceItemXmlLimits` still runs on every entry path, at definition compile time.

**Breaking:** the session engine's test-only method wrappers were removed from the exported
`Player` class (reachable through deep imports such as `@pie-qti/item-player/dist/core/Player.js`;
no package entry exports the class, and the public `ItemSession` facade is unaffected):

- `player.suspendAttempt()`, `player.endAttempt(...)`, `player.scoreAttempt()` — dispatch the
  same actions through the session: `session.dispatch({ action: 'suspendAttempt' })`,
  `session.dispatch({ action: 'endAttempt', countAttempt?, validateResponses? })`,
  `session.dispatch({ action: 'scoreAttempt' })`.
- `player.getSessionState()` — read `session.state()`, or the serialized snapshot via
  `session.serialize()`.
- `player.getTemplateVariables()` — read `session.state().templates`.
- `player.getCorrectResponse(responseId)` — read correct responses from a scorer-role
  `session.present().correctResponses`, or `player.getCorrectResponses()`.

`newTemplate` stays as an engine-level test seam; sessions dispatch it through
`session.dispatch({ action: 'newTemplate' })`.
