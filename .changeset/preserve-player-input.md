---
"@pie-qti/qti-common": patch
"@pie-qti/item-player": patch
"@pie-qti/player-elements": patch
"@pie-qti/default-components": patch
---

Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.
