---
"@pie-qti/to-pie": patch
---

to-pie exports its QTI 3.0 normalization: `normalizeQti3ToQti2`, its three steps (`normalizeQti3Lexically`, `relocateQti3PromptIntoInteraction`, `demoteMisplacedQti3Prompts`), `isQti3Document` and `unsupportedQti3Construct`, so a caller that validates or reports on a QTI 3.0 document judges the shape the conversion consumes.
