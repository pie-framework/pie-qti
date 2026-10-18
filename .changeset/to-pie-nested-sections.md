---
'@pie-qti/to-pie': patch
---

Fix nested-section duplication in `transformAssessmentTest`: nested `<assessmentSection>` elements appeared both at the testPart top level and inside their parent's `subsections`, and the parent collected all descendant item refs. Sections now keep only their direct item refs, with nested sections appearing solely in `subsections`. Section-level `selection`, `ordering`, `timeLimits`, and `preCondition` are likewise read from direct children only. Adds `countAssessmentItems()` and uses it for the registry transform's `itemCount`.
