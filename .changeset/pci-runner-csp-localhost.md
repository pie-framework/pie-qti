---
'@pie-qti/pci-runner': patch
---

Build the runner bundle as a classic IIFE script instead of an ES module, and allow `http://localhost:*` / `http://127.0.0.1:*` scripts in the page's CSP. Module scripts always fetch with CORS, which the sandboxed frame's opaque origin (`null`) can never satisfy, so the module bundle failed to load on any static host that sends no CORS headers; the IIFE needs none, keeping the page deployable anywhere with no server configuration. The CSP loopback allowance lets demo dev/e2e servers host the handshake over plain http. Production script loading remains https-only.
