# QTI Delivery Coverage

**Last reviewed:** 2026-07-13

This document describes implementation coverage. It is not a claim of full conformance or formal
1EdTech certification. The player has broad QTI 2.2 and 3.0 coverage and a compatibility path for
QTI 2.1, but valid documents remain that it cannot render, interact with, or score faithfully.

The authoritative implementation backlog is
[`docs/SPEC-GAPS-PLAN.md`](../../../docs/SPEC-GAPS-PLAN.md).

## Implemented foundations

- Version detection and element/attribute mapper selection for QTI 2.1, 2.2, and 3.0.
- Extractor registrations for the 21 standard QTI 2.2 interaction names.
- Shared QTI 2.x/3.0 response-processing AST and evaluator with broad operator coverage.
- Item response state, feedback, adaptive attempts, role filtering, PNP/catalog support, MathML,
  sanitization, URL policy, and optional iframe isolation.
- Standard interaction renderers in `@pie-qti/default-components`.

Registration or unit extraction does not by itself prove that a schema-valid interaction is
usable in a browser or scores according to the official template semantics.

## Confirmed conformance gaps

### Interaction delivery

- `positionObjectStage` is currently modeled as a child of `positionObjectInteraction`; QTI 2.2
  and 3.0 define the stage as the parent. Schema-valid position-object items extract no interaction.
- QTI 3 HTML elements such as `<object>` are incorrectly routed through the universal `qti-`
  element-name fallback in some extractors. This loses images/media for valid graphical items.
- QTI 3 Portable Custom Interaction parser and host primitives exist, but the extractor, renderer,
  response collection, state restoration, and teardown lifecycle are not connected in production.
- `record` is modeled as a base type instead of a cardinality, and valid record declarations lose
  their field structure.
- Extended-text delivery does not yet cover all single, multiple, ordered, and record response
  forms or the complete string/min/max constraint model.

### Response processing

Filename-based implementations of `match_correct`, `map_response`, and Common Cartridge aliases
do not yet reproduce all official template XML semantics. In particular, current code can operate
across every response declaration, use `MAXSCORE` where the canonical template writes `1`, omit
required `FEEDBACK` outcomes, and does not support `CC2_match_basic.xml`.

External `xi:include` response/outcome-processing fragments are rejected rather than resolved.

### QTI 2.1

QTI 2.1 namespace detection and several Common Cartridge filename aliases exist, but the public and
private conformance runners do not currently exercise a representative QTI 2.1 delivery corpus.
Do not treat backward compatibility with the QTI 2.2 vocabulary as complete 2.1 verification.

## Strict mode

`strictQtiCompliance` provides version/extension checks and diagnostic logging. It is not an XSD
validator and does not close the behavioral gaps listed above.

```typescript
import { Player } from '@pie-qti/item-player';

const player = new Player({
  itemXml: qtiXml,
  strictQtiCompliance: {
    enabled: true,
    rejectUnknownExtensions: true,
    logDeviations: true
  }
});
```

## Verification

- Item tests: `bun test packages/item-player`
- Public clean-room certification gate: `bun run test:certification:public`
- Public coverage matrix: [`docs/certification/`](../../../docs/certification/)
- Official package runner/evidence: sibling private `pie-qti-conformance` repository when available

The current official-package runner is smoke-oriented: construction/no-throw or direct
`setResponse()` paths do not prove that a candidate can render and operate every interaction or
that the resulting score is exact. Certification evidence should therefore include packed-NPM
browser interaction and score assertions.

## Official resources

- [1EdTech QTI standards and releases](https://www.1edtech.org/standards/qti/index)
- [QTI version guidance](https://www.1edtech.org/standards/qti/versions)
- [QTI conformance and certification](https://www.1edtech.org/standards/qti/conformance)
