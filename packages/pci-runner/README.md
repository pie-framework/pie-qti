# @pie-qti/pci-runner

The deployable runner page for the sandboxed PCI engine (plan Option C in
[`docs/plans/pci-runtime-and-sandbox-2026-08.md`](../../docs/plans/pci-runtime-and-sandbox-2026-08.md)):
a static page that executes QTI 3.0 Portable Custom Interaction modules inside
a `<iframe sandbox="allow-scripts">` frame and bridges the §6.1 contract —
registry registration, `getInstance`, `onready`/`ondone`, QTI variable JSON,
`getState()` — back to the player over `postMessage`.

## Why a separate origin

The runner is the security boundary, and it works only from a **dedicated,
cookieless origin** that serves nothing else:

- With `sandbox="allow-scripts"` and no `allow-same-origin`, the frame's
  document gets an opaque origin: it shares no storage, cookies, or DOM with
  the player, no matter what the module does.
- The origin must set no cookies and hold nothing worth reaching — there is no
  credential or session a hostile module could aim at.
- The frame's base URL is still the runner URL, so authored relative asset
  paths inside a PCI resolve normally.
- Per-tenant subdomains are unnecessary: every frame already has its own
  distinct opaque origin.

The page cannot set response headers on a static host, so `frame-ancestors` is
not enforceable by header; the mutual origin locking below covers it. The
package origin serving PCI modules needs `Access-Control-Allow-Origin: *`
without credentials for the resolution-config `fetch` (`<script>` loads need no
CORS).

## Deployment

Build and copy `dist/` to the runner origin's web root:

```sh
bun run --filter '@pie-qti/pci-runner' build
# deploy dist/pci-runner.html and dist/pci-runner.js, side by side, at a stable URL
```

The player then opts in per host:

```js
element.pci = {
	baseUrl: 'https://packages.example.com/bank/',
	sandbox: { runnerUrl: 'https://qti.pie-framework.org/pci-runner.html' },
};
```

`sandbox` takes precedence over `moduleResolver`: the page never evaluates
module code, so there is nothing for a resolver to import. An optional
`modulePolicy` (`createAllowlistPciModulePolicy`) still allow-lists which
module URLs may be handed to the frame.

## Protocol

`pie-qti-pci-sandbox` — see
`packages/item-player/src/pci/sandbox/protocol.ts` for the envelope and
payloads. Origin locking is mutual and rooted at structural facts:

- the host accepts messages only from the runner URL's origin **and** the
  frame's `contentWindow`;
- the runner accepts its first message only from `window.parent`, locks to
  that message's origin, and sends everything to that origin.

The trade-offs of a realm boundary are part of the contract: `getResponse()`
on the host stays synchronous by answering from a cache the runner maintains
(pushes on every observed change, plus a poll bounded by
`sandbox.pollIntervalMs`, default 250 ms), and a module that persists to
`localStorage` or fetches authenticated assets breaks — neither should happen
under the specification, where state travels through `getState()`.
