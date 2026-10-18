# QTI Delivery Coverage

**Last reviewed:** 2026-07-13

This document describes implementation coverage. It is not a claim of full conformance or formal
1EdTech certification. The player has broad QTI 2.2 and 3.0 coverage and a compatibility path for
QTI 2.1, but valid documents remain that it cannot render, interact with, or score faithfully.

QTI 2.1 coverage is ingest compatibility only. Its 1EdTech certification line closed in 2023–2024,
so 2.2 and 3.0 are the only certifiable versions — see
[`docs/certification/README.md`](../../../docs/certification/README.md).

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

`docs/SPEC-GAPS-PLAN.md` is the authoritative, live tracker for conformance work — the list below
covers only what is still open in the item player as of 2026-10-17. Gaps closed since this file was
last audited (position-object hierarchy G-17, QTI 3 foreign-vocabulary mapping G-18, record
cardinality G-21, response-template aliases G-19, extended-text response shapes G-23, processing
fragments G-24, PNP structured labels and braille G-13, the PCI spec contract and AMD module
resolution G-08 phases 1–3, with clean-room conformance fixtures) are tracked there as Done and
are no longer repeated here.

### Interaction delivery

- PCI browser-level evidence in the private runner and third-party content as a same-reading
  check remain open under G-08's evidence thread; the spec contract itself runs (registry,
  `getInstance`, QTI variable JSON, `getState()` restore, AMD loading with resolution configs),
  and the sandboxed engine (plan phase 4) offers opt-in hardened execution in a cross-origin
  runner frame. Page-realm module execution stays gated on the host resolver — a trust decision;
  the sandboxed engine is the containment.

### QTI 2.1

QTI 2.1 namespace detection and several Common Cartridge filename aliases exist, but the public and
private conformance runners do not currently exercise a representative QTI 2.1 delivery corpus.
Do not treat backward compatibility with the QTI 2.2 vocabulary as complete 2.1 verification.

## Strict mode

`strictQtiCompliance` provides version/extension checks and diagnostic logging. It is not an XSD
validator and does not close the behavioral gaps listed above.

```typescript
import { createAssessmentItemDefinition } from '@pie-qti/item-player';

const definition = createAssessmentItemDefinition({
  itemXml: qtiXml,
  strictQtiCompliance: {
    enabled: true,
    rejectUnknownExtensions: true,
    logDeviations: true
  }
});
const session = definition.openSession();
```

## Verification

- Item tests: `bun test packages/item-player`
- Public clean-room certification gate: `bun run test:certification:public`
- Public coverage matrix: [`docs/certification/`](../../../docs/certification/)
- Official package runner/evidence: sibling private `pie-qti-conformance` repository when available

The current official-package runner is smoke-oriented: construction/no-throw or direct
`ItemSession.dispatch({ action: 'setResponse', ... })` paths
do not prove that a candidate can render and operate every interaction or that the resulting score
is exact. Certification evidence should therefore include packed-NPM browser interaction and score
assertions.

## Official resources

- [1EdTech QTI standards and releases](https://www.1edtech.org/standards/qti/index)
- [QTI version guidance](https://www.1edtech.org/standards/qti/versions)
- [QTI conformance and certification](https://www.1edtech.org/standards/qti/conformance)
