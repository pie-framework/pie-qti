---
'@pie-qti/player-elements': patch
'@pie-qti/section-player': patch
---

The section player elements accept `show-feedback` (property `showFeedback`), as the item element does, and the section layouts take a `showFeedback` prop: items whose session the item player owns show their integrated feedback after a submit only when it is set. An item ref carrying a live `session` keeps that session's own policy.
