---
'@pie-qti/default-components': patch
---

The gap-match and graphic-gap-match interactions announce a repeated message again (WCAG 4.1.3). A live region speaks a change of its text, and the two interactions wrote their `aria-live` region from a plain string, so two identical messages in a row — the same over-limit refusal, the same match-group "not available" — left the text unchanged and assistive technology stayed silent the second time. They now use the shared announcer the other interactions use, whose repeat appends a trailing zero-width space, so the region still changes and the second refusal is announced. The messages themselves are unchanged.
