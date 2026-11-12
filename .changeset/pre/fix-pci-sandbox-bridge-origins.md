---
'@pie-qti/item-player': patch
---

Fix the PCI sandbox postMessage bridge, which could not deliver a message in either direction: the runner frame is `sandbox="allow-scripts"` (opaque origin, serialized as `"null"`), so the connector's incoming `event.origin` check against the runner tuple origin never matched and its outgoing tuple target origin never matched the frame. Incoming messages are now anchored on the frame's own `contentWindow` (the identity check, already first, stays the real anchor) and accept the runner origin or its `"null"` opaque serialization; outgoing messages post to the frame's window with target origin `'*'`, bounded by the recipient window, since no tuple target can ever match an opaque origin. The reasoning is documented in the connector JSDoc and in docs/iframe-mode.md. Note: jsdom-level tests assert the filter logic only; a manual/e2e verification of the real browser handshake against a deployed runner remains open.
