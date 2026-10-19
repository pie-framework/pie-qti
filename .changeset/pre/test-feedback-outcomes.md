---
'@pie-qti/assessment-player': patch
'@pie-qti/player-elements': patch
'@pie-qti/qti-processing': patch
---

Show `testFeedback` at test and test-part level by typed outcome values, single or multiple, with `access="during"` during the test and `atEnd` at the end of the test or its part. The backend contract returns `outcomes` from `submitResponses`, a resumed `initSession` and `finalizeAssessment`; `sum` and `product` accept multiple and ordered containers; QTI 3 items score under their own identifier.
