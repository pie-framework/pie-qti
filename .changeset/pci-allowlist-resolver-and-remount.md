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
construction error rather than a silent deny-all. Note that `PciConfiguration.baseUrl`
is where authored relative paths resolve, so it has to fall inside the allow-list
itself.

`PciHost.restore()` no longer calls `module.setResponse` on a mounted module that
has a rebuild path. It fires the new `onRemountRequest` signal; the renderer resets
the sanitized scaffold, calls `remount(dom)` — which discards the previous
instance, resolves a fresh one, and seeds the restored value — and returns focus
into the rebuilt scaffold, since replacing the scaffold destroys whatever the
candidate had focused. Discarding in-progress candidate state is what
re-instantiation means, and it is the only form the QTI 3.0 PCI contract offers,
since state is injected at `getInstance` and there is no setter.

Two consequences of that being asynchronous and renderer-driven. `getResponse()`
reports the restored value for as long as a requested rebuild has not landed,
because until it does the mounted module still holds the superseded one. And a host
that drives `PciHost` directly, with nothing subscribed to `onRemountRequest`, gets
the value pushed into the module instead — mutation rather than a discard, which is
the most a caller owning no scaffold can do, and it keeps reset-to-default and
session restore effective there. Before mount, `restore()` still just holds the
value for `initialize()`.

`PciHostController` gains `onRemountRequest` and `remount`.
