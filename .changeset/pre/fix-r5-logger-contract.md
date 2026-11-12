---
'@pie-qti/logger': patch
---

The universal `Logger` interface is now coherent: all four levels (`debug`, `info`, `warn`, `error`) are required, matching the documented contract ("compatible with the browser console object") and what every in-repo implementation already provides. Previously `debug`/`warn` were required while `info`/`error` were optional, so an implementation with no error output typechecked as a `Logger` and every consumer had to defensive-call `logger.error?.()`. The browser `Logger.child()` also composes prefixes from raw names now, so `createLogger('Parent').child('Child')` logs `[Parent:Child] test` as its documentation always promised (it previously logged `[Parent]:Child test`).

Breaking: `noopLogger` and `consoleLogger` were removed from `@pie-qti/logger`. Both had zero consumers anywhere in the repo (the server entry's `ConsoleLogger` class is a different symbol and is unaffected); for a no-op logger use the server entry's `SilentLogger` or your own four-method stub. Implementations of the `Logger` interface that omitted `info` or `error` must now provide them.
