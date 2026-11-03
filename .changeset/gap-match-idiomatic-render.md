---
'@pie-qti/default-components': patch
---

Fix the gap-match interaction rendering the prompt **twice** — once as static HTML with dead `[GAP:...]` markers, and again as the interactive text with live blanks. The prompt (with its gaps) now renders once, declaratively: the prompt text is split on the extractor's `[GAP:id]` markers into sanitized segments, each sent to the `{@html}` sink separately (keeping every sink call policy-checked for Trusted Types), with Svelte-rendered gap buttons between them. This removes the component's hand-built DOM layer — per-gap `document.createElement` with six manual listeners and a cleanup array, plus a re-render effect carrying five eslint suppressions. Focus is now preserved by the framework (nodes persist across updates) instead of a manual refocus hack. Adds first component coverage for gap-match: single render, pick-up/place flow, clear-on-click, scorer correct-answer display, multi-gap ordering.
