---
'@pie-qti/section-player': patch
---

**Section events are delivered once** (beta prerelease). The section layouts fired every framework error, response delta and display-settings change through both channels — the composition's `QtiSectionRuntimeHostContract` callback *and* the layout's callback prop — so a host that supplies the contract (the natural way to carry the package/URL-policy hooks) and embeds `pie-qti-section-player-*` listening to the documented DOM events heard every occurrence twice. The two channels are alternatives, as the README always said: the layout now delivers through the host contract's callback when the composition's `host` carries it, and the callback prop — the custom elements' DOM event source — fires only when that slot is absent. A host relying on the double delivery (there is no reason to) sees one event per occurrence now.
