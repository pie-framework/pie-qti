---
'@pie-qti/section-player': patch
'@pie-qti/i18n': patch
---

The passage collapse control keeps one name in both states (WCAG 4.1.2).

Its accessible name used to carry the state as an action verb ("The Water Cycle — Collapse passage", then "The Water Cycle — Expand passage") while `aria-expanded` changed as well, so the state was announced twice and the name a voice-control user speaks changed with every press. The control is now labelled by the passage's heading ("The Water Cycle", or the neutral "Passage" / "Passage 2" for an untitled one) and `aria-expanded` alone carries the state. The visible chevron is unchanged.

**Breaking: locale keys removed** (beta prerelease). `assessment.expandPassage` and `assessment.collapsePassage` have no use left and are removed from all locales. Hosts that override these keys in a custom catalog can drop the overrides.
