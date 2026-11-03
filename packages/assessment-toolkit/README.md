# @pie-qti/assessment-toolkit

Small helper surface shared by hosts embedding the assessment players:

- **Role/view filtering** — re-exports `normalizeQtiViewTokens` and
  `isQtiViewVisibleForRole` from `@pie-qti/section-player` (the semantics live
  there; this package gives consumers one stable import point) and adds
  block-level role filtering on top.
- **Tool normalization** — `normalizeQtiToolConfig`, the shared
  enabled/`tool`-attribute filter used by the section player's composition.
- **Shared context normalization** — helpers for normalizing shared stimulus
  context payloads.

## Consumers

`@pie-qti/assessment-player` (its `toSectionComposition` integration). The
package intentionally stays tiny; anything with real semantics belongs in
`section-player` or `item-player`.

## License

MIT
