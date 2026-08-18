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

`PciHost.setResponse` is replaced by `offerResponse(value)`, which offers a value
and returns `false` once the module has reported a response of its own, and
`restore(value)`, which replaces the response authoritatively and returns
ownership to the player. Session deserialization and reset-to-default use
`restore()`; ordinary traffic uses `offerResponse()`. `offerResponse` is named for
what it does — the value may be declined — and avoids colliding with Svelte's
sense of "hydrate".

`Player.setPciResponse` is likewise replaced by `offerPciResponse` and
`restorePciResponse`, and `PciHostController` gains `offerResponse`/`restore` in
place of `setResponse`. `Player.setResponses` keeps its single-argument signature;
callers needing the authoritative path use the new `Player.restoreResponses`
rather than an options flag. PCI execution still requires a host-supplied
`moduleResolver`, so no delivery that runs today changes behavior.
