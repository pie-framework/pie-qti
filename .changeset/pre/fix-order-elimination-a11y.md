---
'@pie-qti/default-components': patch
---

Fix the order interaction's elimination tool being hidden from assistive technology while remaining keyboard-operable. The button column was marked `aria-hidden="true"`, which a descendant cannot override — screen-reader users could tab onto ✕ buttons that were never announced, and could not use the Personal Needs and Preferences elimination feature at all (WCAG 4.1.2). The buttons are now exposed with their `aria-label`/`aria-pressed` state, matching the accessible structure the choice interaction already uses for the same feature.
