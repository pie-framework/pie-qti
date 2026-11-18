---
'@pie-qti/assessment-player': patch
'@pie-qti/player-elements': patch
---

Breaking: `SecureAssessment.navigationMode` and `SecureAssessment.submissionMode` are removed, and backends must send both modes on every `SecureTestPart`. The test parsers no longer synthesize a test part from sections placed directly under `assessmentTest`, which the QTI schema does not allow.
