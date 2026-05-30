# Public QTI 2.2 and 3.0 Advanced DELIVERY Coverage Matrix

This matrix is the public, redistributable certification gate for `pie-qti`.
It intentionally uses clean-room fixtures and project-authored tests only.
Official 1EdTech packages stay in the private conformance project.

The machine-readable source of truth is `public-coverage-matrix.json`.
`bun run test:certification:public` validates that every row below has public
evidence and runs the mapped tests.

| Version | Feature | Public evidence | Browser required |
| --- | --- | --- | --- |
| QTI 2.2 Advanced | Q2 Advanced choiceInteraction validation | `packages/item-player/src/extraction/extractors/conformance.test.ts` | No |
| QTI 2.2 Advanced | Q6 gapMatchInteraction | `packages/item-player/tests/conformance/run-fixtures.test.ts`, `packages/item-player/src/extraction/extractors/conformance.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 2.2 Advanced | Q8 graphicGapMatchInteraction | `packages/item-player/tests/conformance/run-fixtures.test.ts`, `packages/item-player/src/extraction/extractors/conformance.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 2.2 Advanced | Q10 hotspotInteraction | `packages/item-player/tests/conformance/run-fixtures.test.ts`, `packages/item-player/src/extraction/extractors/conformance.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 2.2 Advanced | Q11 hottextInteraction | `packages/item-player/tests/conformance/run-fixtures.test.ts`, `packages/item-player/src/extraction/extractors/conformance.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 2.2 Advanced | Q12 inlineChoiceInteraction | `packages/item-player/tests/conformance/run-fixtures.test.ts`, `packages/item-player/src/extraction/extractors/conformance.test.ts` | No |
| QTI 2.2 Advanced | Q13 matchInteraction | `packages/item-player/tests/conformance/run-fixtures.test.ts`, `packages/item-player/src/extraction/extractors/conformance.test.ts` | No |
| QTI 2.2 Advanced | I17 composite item | `packages/item-player/tests/conformance/run-fixtures.test.ts`, `packages/item-player/src/extraction/extractors/conformance.test.ts` | No |
| QTI 2.2 Advanced | P7 QTI metadata | `packages/item-player/src/extraction/extractors/conformance.test.ts` | No |
| QTI 2.2 Advanced | S3/S4 selection and ordering | `packages/assessment-player/tests/conformance-qti22-advanced.test.ts` | No |
| QTI 2.2 Advanced | S5 rubricBlock in sections | `packages/assessment-player/tests/conformance-qti22-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 2.2 Advanced | T1 outcomeDeclaration | `packages/assessment-player/tests/conformance-qti22-advanced.test.ts` | No |
| QTI 2.2 Advanced | T5 itemSessionControl | `packages/assessment-player/tests/conformance-qti22-advanced.test.ts` | No |
| QTI 2.2 Advanced | T12 sections with T2/S1/S9 | `packages/assessment-player/tests/conformance-qti22-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | Q2 Advanced choiceInteraction Shared Vocabulary | `packages/item-player/src/extraction/extractors/conformance-qti3-basic.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | Q5 Advanced extendedTextInteraction Shared Vocabulary | `packages/item-player/src/extraction/extractors/conformance-qti3-basic.test.ts`, `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts` | No |
| QTI 3.0 Advanced | Q6 gapMatchInteraction Shared Vocabulary | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | Q8 graphicGapMatchInteraction | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | Q10 hotspotInteraction | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | Q11 hottextInteraction | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | Q12 inlineChoiceInteraction with MathML | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `packages/typeset-katex/tests/mathml.test.ts` | No |
| QTI 3.0 Advanced | Q13 matchInteraction Shared Vocabulary | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts` | No |
| QTI 3.0 Advanced | I4 Shared Stimulus | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | I17 composite item | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts` | No |
| QTI 3.0 Advanced | I19b/I20 Shared Vocabulary FULL CSS | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | P7 QTI metadata | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts` | No |
| QTI 3.0 Advanced | A13 captions and A15 glossary | `packages/item-player/src/extraction/extractors/conformance-qti3-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | S3/S4 selection and ordering | `packages/assessment-player/tests/conformance-qti30-advanced.test.ts` | No |
| QTI 3.0 Advanced | S5 rubricBlock in sections | `packages/assessment-player/tests/conformance-qti30-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |
| QTI 3.0 Advanced | T1 outcomeDeclaration | `packages/assessment-player/tests/conformance-qti30-advanced.test.ts` | No |
| QTI 3.0 Advanced | T5 itemSessionControl | `packages/assessment-player/tests/conformance-qti30-advanced.test.ts` | No |
| QTI 3.0 Advanced | T12 sections with T2/S1/S9 | `packages/assessment-player/tests/conformance-qti30-advanced.test.ts`, `apps/demo/tests/playwright/public-certification.pw.ts` | Yes |

## Private Cross-Check

The private `pie-qti-conformance` project may map these rows back to official
package paths, but this public matrix must remain runnable without `../qti-conformance`,
private credentials, or committed official ZIPs.
