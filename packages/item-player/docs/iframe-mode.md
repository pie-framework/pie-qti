# Iframe mode (reference)

`@pie-qti/item-player` can be used in an **iframe-isolated** deployment to reduce the impact of untrusted QTI content.

This repo ships:

- **Host helper**: `@pie-qti/item-player/iframe` (browser-only)
- **Protocol types**: `QtiIframeEnvelope` + runtime validators

It does **not** ship a production-ready iframe runtime page/app. Integrators host their own runtime (the `example` app contains a **reference runtime** for demo/testing only).

## Core idea

```mermaid
sequenceDiagram
  participant HostApp
  participant IframeRuntime

  HostApp->>IframeRuntime: Load iframe URL (sandboxed)
  IframeRuntime->>HostApp: READY
  HostApp->>IframeRuntime: INIT(itemXml, role, security, responses)
  IframeRuntime->>HostApp: RESPONSE_CHANGE(responses)
  HostApp->>IframeRuntime: SUBMIT
  IframeRuntime->>HostApp: SUBMIT_RESULT(result)
  IframeRuntime->>HostApp: RESIZE(height)
```

## Security guidance

- **Best isolation**: host the iframe runtime on a **separate origin** (recommended), and set:
  - `sandbox="allow-scripts allow-same-origin"`
  - strict `postMessage` origin allowlists on **both** sides
- **Same-origin runtime**:
  - if you set `allow-same-origin` and the iframe is same-origin with the host, JS inside the iframe can access the host via `window.parent` (not an isolation boundary).
  - if you omit `allow-same-origin`, the iframe origin becomes **opaque** and `event.origin` will be `"null"`. This often breaks module-script loading unless your server allows `Origin: null`.
- **Origin allowlists**:
  - if you intentionally use an opaque-origin sandbox, you may need to allow `"null"` as an origin on the host side (not recommended for production; prefer a real, dedicated runtime origin).

### The built-in PCI sandbox frame (`createIframeFrameConnector`)

Portable Custom Interaction modules run in their own frame with `sandbox="allow-scripts"` —
**without** `allow-same-origin`, so the frame's origin is opaque and serializes as `"null"`.
The bridge is built around that reality:

- **Parent → frame**: messages are posted to the frame's `contentWindow` with target origin
  `'*'`. A tuple target origin can never match an opaque origin, so a locked target would
  silently drop every message. The recipient is bounded by the target window; the frame is
  scripts-only and cannot reach parent state.
- **Frame → parent**: messages are accepted only when `event.source` is the frame's own
  `contentWindow` (the identity anchor — a sender cannot forge a source window) and
  `event.origin` is the runner origin **or** `"null"` (the opaque serialization this frame
  always produces). A foreign origin matches neither and is rejected.
- **Runner-side expectations** (integrator-owned): validate `event.source === window.parent`,
  and lock replies to the configured parent origin — the parent page is *not* sandboxed, so
  its `event.origin` is the real tuple origin, never `"null"`.

A jsdom-level test can only assert the filter logic, not browser origin semantics; verify the
real `postMessage` handshake in a browser against your deployed runner.

## Host usage (recommended)

```ts
import { IFramePlayerHost } from '@pie-qti/item-player/iframe';

const host = new IFramePlayerHost({
  container: document.getElementById('player')!,
  iframeUrl: 'https://player-runtime.example/runtime.html',
  allowedOrigins: ['https://player-runtime.example'],
  sandbox: 'allow-scripts allow-same-origin',
  // Optional: reduce referrer leakage when the runtime loads assets
  referrerPolicy: 'no-referrer',
});

host.on((evt) => {
  if (evt.type === 'responseChange') console.log(evt.payload.responses);
  if (evt.type === 'submitResult') console.log(evt.payload.result);
});

await host.ready();
await host.init({ itemXml, role: 'candidate' });
```

## Runtime requirements (integrator-owned)

Your runtime page should:

- validate incoming `message` events:
  - `event.source === window.parent`
  - `event.origin === expectedParentOrigin` (configured; not `*`)
- respond with `READY` immediately on load
- implement handlers for `INIT`, `SET_RESPONSES`, `SUBMIT`, `RESET`
- emit `RESPONSE_CHANGE`, `SUBMIT_RESULT`, and `RESIZE`
 - use `ResizeObserver` (or similar) to keep the host container sized correctly

See the reference runtime implementation:

- `apps/demo/src/routes/iframe-runtime/+page.svelte` (non-production)


