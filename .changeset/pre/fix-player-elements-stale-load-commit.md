---
'@pie-qti/player-elements': patch
---

Fix a superseded-load race in `QtiAssessmentPlayerElement`'s local reference-backend path: the load sequence was re-checked only after the first await (bounded item resolution), but not after the second one — `ReferenceBackendAdapter.parseAssessmentTestXml`, which resolves external section and item files through the resource resolver and does not observe the supersede abort. A load superseded while that parse ran (a newer `assessmentTestXml`, a `backend` injection, or a disconnect) went on to register the stale assessment, replace an injected production backend with the local answer-bearing one, dispatch a second `load-end`, and mount an interactive shell for the wrong assessment — including after `disconnectedCallback`. The element now re-checks the load sequence immediately after that parse and discards a superseded result before any state mutation.
