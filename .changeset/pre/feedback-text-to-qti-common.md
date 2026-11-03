---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/qti-common': patch
---

Move the feedback-text utilities (`cleanFeedbackText`, `processFeedbackInline`, `DEFAULT_FEEDBACK_TRANSFORMS`, `DEFAULT_FEEDBACK_OUTCOME_ID`, `FeedbackTransform`, `ProcessFeedbackInlineOptions`) to `@pie-qti/qti-common`, which already owns the feedback visibility rule they build on (`isShownByIdentifier`). The `@pie-qti/item-player/components/utils` subpath export is removed — it existed only to expose these two functions to a single internal consumer. Import the functions from `@pie-qti/item-player`'s or `@pie-qti/qti-common`'s main entry instead.
