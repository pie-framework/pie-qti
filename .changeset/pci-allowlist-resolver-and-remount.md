---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
---

Make PCI deliverable, and rebuild a module on authoritative restore.

`createAllowlistPciModuleResolver({ allowedOrigins, allowedPathPrefixes })` is a
new export from `@pie-qti/item-player`. PCI execution previously required every
host to write the security-critical resolver itself, so in practice no deployment
ran a PCI at all. The secure default is unchanged — a host must still pass a
resolver, and doing so is still a trust decision — but the origin and prefix check
now ships reviewed. Prefixes match the normalized URL so traversal cannot escape
them, non-http(s) schemes are refused outright, and an empty allow-list is a
construction error rather than a silent deny-all.

`PciHost.restore()` no longer calls `module.setResponse` on a mounted module. It
fires the new `onReinitializeRequest` signal; the renderer resets the sanitized
scaffold and calls `remount(dom)`, which discards the previous instance, resolves
a fresh one, and seeds the restored value. Discarding in-progress candidate state
is what re-instantiation means, and it is the only form the QTI 3.0 PCI contract
offers, since state is injected at `getInstance` and there is no setter. Before
mount, `restore()` still just holds the value for `initialize()`.

`PciHostController` gains `onReinitializeRequest` and `remount`.
