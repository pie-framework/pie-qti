---
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
---

Last legacy and compatibility paths removed from the item player (cleanup addendum).

**Breaking: PCI responses are read only in the PCI v1.0 Appendix A binding.** `fromQtiVariableJson`, and so every PCI `getResponse()` answer, no longer reads two non-spec forms; both now read as NULL:

- a `{"base": {...}}` or `{"list": {...}}` wrapper whose key is not a QTI base-type name (it used to be read by the response declaration's base type);
- anything that is not variable JSON: a raw runtime value such as `"A B"`, a number, an array, or an object with no `base`, `list` or `record` key (it used to pass through unchanged).

A PCI module answering in such a form stores no response and scores as unanswered. PCI modules must answer in the PCI v1.0 Appendix A binding (`{"base": {"<baseType>": value}}`, `{"list": {"<baseType>": [...]}}`, `{"record": [{"name": ..., "base" | "list": ...}]}`). A valid base-type name keeps being read by that base type, also when it differs from the declaration's. `fromQtiVariableJson` takes no second argument any more, and the `QtiVariableJsonDeclaration` type is no longer exported; drop the argument.

**Breaking: parsing limits apply unless the host opts out.** `security.parsingLimits` (item XML size, HTML size, element count and depth, DOCTYPE rejection) used to apply below the custom elements only when a host passed `enabled: true`. It now applies at every layer unless the host passes `enabled: false`: `Player`, `createAssessmentItemDefinition` (the root and the `/server` entry), `AssessmentItemDocument`, `sanitizeHtml`, and `sanitizeSharedHtml` / `enforceItemXmlLimits` / `normalizeParsingLimits` from `@pie-qti/item-player/security`. With no security config, an item containing `<!DOCTYPE` or over 10 MB is rejected, and HTML over 5 MB, 200 000 elements or depth 200 sanitizes to an empty string. To opt out, for trusted content or behind an equivalent upstream limit, pass `security.parsingLimits.enabled: false`; to allow more, raise the individual limit. The `<pie-qti-item-player>` and assessment custom elements already applied these defaults and behave as before.

Also:

- The `@pie-qti/item-player/server` entry's DOM-free `Server*` types are now checked against the engine's at compile time, so the two cannot drift apart unnoticed. The published types are unchanged.
- Documentation corrections: why the sandbox init payload's `language` is optional (an item with no content language), what PNP `magnification` does (it is set on the player root for host stylesheets, and the default stylesheet does not render it), that QTI 3.0 defines `qti-position-object-interaction`, and the structured-label NVDA checklist (the choice group is always named by its prompt; the flag adds the match interaction's group and column labels).
