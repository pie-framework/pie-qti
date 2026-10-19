---
'@pie-qti/default-components': patch
---

Reject a checkbox selection that would exceed `maxChoices` immediately, so the refused choice no longer stays visually checked while missing from the response. Adds jsdom-based component behavior tests for the choice, hottext, hotspot, extended-text and upload components.
