---
'@pie-qti/item-player': patch
---

The item body's failures now reach the coded error channel. Interaction mount/update failures and component-registry failures report `render-failed` — the code finally means what it says, after real render failures previously got nothing but a console line — while the rest of the item keeps rendering, and a failed mount stands in as a visible `role="alert"` placeholder naming the interaction type, styled like the player's load-failure alert. A rejected response write reports the new additive `response-dispatch-failed` code on `ItemPlayerErrorCode` instead of mislabelling itself `render-failed`; it keeps the generic "Failed to process responses" message as before.

Breaking: the exported `ItemBody` component's `onError` prop now receives an `ItemBodyError` (`{ code: 'render-failed' | 'response-dispatch-failed', cause: unknown }`) instead of the bare thrown value.
