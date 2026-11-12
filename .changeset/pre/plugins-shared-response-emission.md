---
'@pie-qti/default-components': patch
---

All interaction plugins now emit response changes through the shared `emitInteractionChange` helper instead of seventeen hand-rolled copies of the notify-and-dispatch trio. Every `qti-change` event now carries the same non-empty-response-id guard, bubbling/composed flags, and timestamp shape regardless of which interaction produced it (several hand-rolled sites lacked the guard or dispatched conditionally). The graphic-associate hotspots now expose their pairing selection state via `aria-pressed`, so screen readers can hear which hotspot is held while composing an association.
