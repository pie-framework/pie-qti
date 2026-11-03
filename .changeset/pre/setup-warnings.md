---
'@pie-qti/item-player': patch
'@pie-qti/qti-common': patch
'@pie-qti/section-player': patch
---

Surface silently-degraded host setup as one-time console warnings (new `warnOnce` helper in `@pie-qti/qti-common`):

- No `i18n` provider on the item player: UI messages would render as raw keys (e.g. `item.parsingError`) and `lang`/`dir` attributes are never set.
- `locale` attribute set without an `i18n` provider: previously a silent no-op.
- Section TTS tool using the default host-served `/api/tts` endpoint: the host must serve that route or override the provider config.

Warnings fire only on actual misconfiguration (deliberately not environment-gated, since the workspace ships both tsc- and vite-built outputs and a missing-wiring warning is useful in production too).
