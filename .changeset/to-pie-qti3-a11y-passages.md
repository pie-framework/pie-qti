---
"@pie-qti/to-pie": patch
"@pie-qti/qti-common": patch
---

to-pie converts QTI 3.0 items, stimuli and tests: `normalizeQti3ToQti2` renames them into the QTI 2.2 vocabulary at the entry point, a vendor transformer still sees the authored document, and a portable custom interaction stays rejected. QTI 3.0 catalogs, APIP access elements and inline SSML become PIE accessibility catalogs keyed by `data-catalog-idref`, companion materials land in `metadata.companionMaterials`, and anything not carried warns `QTI_ACCESSIBILITY_NOT_CARRIED`. Passages convert once per stimulus document through `convertQtiPassageDocument` and come out of the package transform beside the items, prompts keep only the stem, and an unresolvable passage reference warns `QTI_PASSAGE_UNRESOLVED`. `PieAssessment` drops `accessibilityCatalogs` and `stimulusRefs` along with the `StimulusRef` type, and its sections carry `rubricBlocks` in the PIE players' `RubricBlock` shape in place of `rubricRefs`. qti-common exports `QTI3_ATTRIBUTE_TO_QTI2` and `QTI2_PROMPT_BEARING_INTERACTIONS`.
