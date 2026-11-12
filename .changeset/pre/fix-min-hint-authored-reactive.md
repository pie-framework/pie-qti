---
'@pie-qti/default-components': patch
---

The choice interaction's authored minimum message (`data-min-selections-message`) now renders in the delivered (custom-element) path. It was read once at component creation, before delivery assigned the interaction's props, so it was captured as undefined and an author's message never appeared — and for `minChoices=1` questions with an authored message, no hint appeared at all.
