---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
---

Give a mounted PCI module ownership of its own response.

Every candidate change reaches `Player.setResponses`, a PCI module's own reports
included, and that pushed straight back into the module with no dirty check — so
each reported response was immediately handed back, rebuilding whatever internal
state the module derived from it. The renderer's reactive `response` prop carried
a second copy of the same loop.

`PciHost.setResponse` is replaced by `hydrate(value)`, which offers a value and
returns `false` once the module has reported a response of its own, and
`restore(value)`, which replaces the response authoritatively and returns
ownership to the player. Session deserialization and reset-to-default use
`restore()`; ordinary traffic uses `hydrate()`. Hosts that need their value to win
mid-attempt pass `setResponses(responses, { authoritative: true })`.

`Player.setPciResponse` is likewise replaced by `hydratePciResponse` and
`restorePciResponse`, and `PciHostController` gains `hydrate`/`restore` in place of
`setResponse`. PCI execution still requires a host-supplied `moduleResolver`, so
no delivery that runs today changes behavior.
