---
"@pie-qti/section-player": patch
---

Use the upstream `pie-players` TTS highlight resolver pipeline for projected QTI content instead of patching private highlight coordinator methods. Consumers with pinned `@pie-players/*` packages must upgrade to the first fixed version that includes the resolver API.
