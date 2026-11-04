---
'@pie-qti/default-components': patch
'@pie-qti/player-elements': patch
---

Guard all custom-element registrations emitted in shipped bundles. Importing `@pie-qti/default-components/plugins` directly, or via `@pie-qti/player-elements/register`, no longer throws `InvalidStateError` when the elements are already registered — loading several of these entry points together, or loading the same one twice, is now safe. Builds additionally run a new post-build guard step, and `check:ce-define-safety` now also validates shipped `dist` bundles, not only source.
