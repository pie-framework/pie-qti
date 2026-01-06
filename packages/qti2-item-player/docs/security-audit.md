# Security Audit Report — `@pie-qti/qti2-item-player`

Date: 2026-01-05  
Scope: **core + default components** in `packages/qti2-item-player`  
Threat model: **untrusted third‑party QTI** rendered **directly into the host DOM** (no iframe sandbox).  
Plugin stance: plugins/custom components are **integrator-owned trust boundary**; framework should provide **minimal seatbelts** (helpers + clear docs), not a sandbox.

## Executive summary

### Top risk (must-fix for untrusted same-DOM)

The highest risk area for this project remains: **rendering attacker-controlled content into the host DOM**. That said, the specific “must-fix” sanitizer/URL gaps identified in this report have been **addressed** (see “Status updates” below). The remaining risk is primarily **architectural** (same-DOM embedding) and **deployment-level** (CSP/Trusted Types, hosting choices), not a known bypass in core.

### Prioritized findings

| Severity | Finding | Status |
| --- | --- | --- |
| **Critical** | Sanitizer bypasses (mixed-case `on*`, `srcdoc`, SVG `xlink:href`). | **Addressed** (commit `a87ca31`) |
| **High** | Missing central URL policy + protocol-relative URL allowance. | **Addressed** (commit `a87ca31`) |
| **High** | Default `<object>` rendering for `mediaInteraction` with attacker-controlled `data`/`type`. | **Addressed** (commit `a87ca31`) |
| **Medium** | XML/HTML parsing DoS: no explicit `<!DOCTYPE ...>` rejection; no size limits for `itemXml`/HTML strings. | **Addressed** (opt-in `security.parsingLimits`) |
| **Medium** | CSP guidance + defense-in-depth for same-DOM (`Trusted Types`, sandboxing patterns). | **Partially addressed** (iframe reference + TT support; docs still need expansion) |
| **Medium** | Supply chain/CSP friction: runtime CDN load for `MathLiveEditor` CSS. | **Addressed** (configurable; default still jsdelivr) |
| **Low** | Prototype pollution: current patterns did not reproduce global pollution in runtime tests, but hardening guidance recommended. | **Open (low)** |

## Status updates (what has been fixed)

The following recommendations from this report have been implemented in core (commit `a87ca31`):

- Sanitizer hardening: case-insensitive `on*` stripping; `srcdoc` handling; SVG `xlink:href` handling; `srcset` handling; additional tag/attribute risk reductions.
- Central URL policy: introduced and applied both to sanitizer URL-bearing attributes and extracted URL fields.
- `<object>` embeds: default behavior changed to be **opt-in** (safer default for untrusted content).
- `MathLiveEditor`: CDN CSS URL is configurable (default remains `cdn.jsdelivr.net`).
- Security regression tests expanded to cover the bypass classes above.

Additional hardening implemented after `a87ca31`:

- Trusted Types support (optional, defense-in-depth for same-DOM): `PlayerSecurityConfig.trustedTypesPolicyName` allows the player to return `TrustedHTML` for HTML injection sinks when the host enables TT via CSP.
- Iframe-isolated deployment guidance: reference doc added at `packages/qti2-item-player/docs/iframe-mode.md`, and a host/protocol implementation exists under `packages/qti2-item-player/src/iframe/*`.
- `hottextInteraction` extracted `contentHtml` is explicitly sanitized before being injected via `{@html ...}`.

## Evidence and impact

### 1) Critical — DOM XSS via sanitizer bypasses

#### Where HTML hits the DOM

- `ItemRenderer` injects processed HTML using `innerHTML`.
- Many Svelte components render QTI-derived strings via `{@html ...}` (choice labels, prompts, inline SVG, feedback, etc.).

#### Core sanitizer implementation (pre-`a87ca31`)

Before `a87ca31`, the sanitizer used a fixed list of lower‑case event handler names (`onclick`, `onload`, …) and checked them with:

- `if (attr in attrs) element.removeAttribute(attr);`

But `node-html-parser` preserves attribute casing, e.g. `onClick`, `oNLoAd`, which means `onclick` will not match.

#### Verified sanitizer behavior (local reproduction, pre-`a87ca31`)

Sanitizing this payload:

- `<p onClick="alert(1)" oNLoAd="alert(2)">...`
- `<iframe srcdoc="<img src=x onerror=alert(5)>"></iframe>`
- `<a xlink:href="javascript:alert(3)" ...>`

Results in:

- event handlers **still present** (`onClick`, `oNLoAd`)
- `iframe[srcdoc]` **still present** (and remains attacker-controlled HTML)
- `xlink:href` **still present**

This is a direct XSS risk in a same-DOM embedding.

#### Current behavior (post-`a87ca31`)

The sanitizer has been hardened to remove mixed-case `on*` handlers, handle `srcdoc`, and apply URL policy to relevant attributes (including SVG URL-bearing attributes). The security regression tests cover these bypass classes to prevent regressions.

#### Why `srcdoc` is especially dangerous

Even if `iframe[src]` is sanitized, `srcdoc` is an HTML document string and can execute scripts inside the iframe. If the iframe is not sandboxed (default), it may still be used for phishing, clickjacking UI overlays, and (depending on origin / browser behaviors) may interact with the parent in unexpected ways. It should be **removed or sandboxed by default** for untrusted items.

#### Recommended remediations (URL policy)

Core fix (recommended):

- Replace the hard-coded event handler list with a **case-insensitive rule**: remove any attribute whose name matches `/^on/i`.
- Add coverage for **URL-bearing attributes** beyond the current list:
  - `srcdoc` (treat as **always forbidden** in untrusted content)
  - `srcset`
  - SVG `xlink:href` and/or `href` on SVG elements
- Add **tag-based allow/deny**:
  - consider outright removing elements such as `iframe`, `object`, `embed`, `foreignObject` (SVG), `meta`, `base` for untrusted content
- Consider switching to a hardened sanitizer (e.g., DOMPurify) with an explicit config for SVG/MathML if that’s acceptable for the project.

Testing:

- Expand `tests/security/xss-prevention.test.ts` to include:
  - mixed-case `onClick`, `oNLoAd`
  - `iframe srcdoc=...`
  - SVG `<a xlink:href="javascript:...">`

**Status**: **Addressed** (commit `a87ca31`), with added regression tests.

### 2) High — Missing central URL policy (core extraction → DOM attributes)

The sanitizer only affects **HTML strings** passed through it. Many resource URLs are extracted as plain strings and bound directly to DOM attributes:

- `img src={interaction.imageData.src}`
- `<source src={interaction.mediaElement.src}>`
- `<object data={interaction.mediaElement.src}>`

The extraction layer reads these as raw attributes (e.g., `src`, `data`) without applying `sanitizeUrl` or any host/protocol policy.

Additionally, within the sanitizer itself, `hasSafeProtocol()` treats any value starting with `/` as safe, which includes **protocol-relative** URLs like `//evil.example/x.png` (remote tracking / unexpected network).

#### Recommended remediations (mediaInteraction `<object>`)

Add a centralized, configurable **URL policy** in `PlayerConfig` (or in extraction context) that:

- Blocks **protocol-relative** URLs by default (`//...`)
- Allows only:
  - relative URLs (optionally resolved against an explicit `assetBaseUrl`)
  - `https:` (optionally host-allowlisted)
- Treats `data:` as **context-sensitive**:
  - allow `data:image/*` for `<img src>` only (optional)
  - disallow `data:` for `<object data>`, `<iframe src>`, etc.
- Provides an explicit “no-network” mode for fully offline/untrusted packages.

Minimal seatbelt (plugin boundary):

- Export a helper like `createUrlPolicy(...)` that integrators can apply to plugin-defined components/extractors.

**Status**: **Addressed** (commit `a87ca31`) via a centralized URL policy applied to extracted URL fields and sanitizer URL-bearing attributes.

### 3) High — Default `<object>` rendering for `mediaInteraction`

The default `mediaInteraction` component renders:

- `<object data={interaction.mediaElement.src} type={interaction.mediaElement.mimeType}>`

This can embed active content depending on MIME type and URL (including SVG and HTML-ish payloads). Combined with the lack of URL policy, this is dangerous for untrusted content.

#### Recommended remediations (DoS limits)

Core default hardening:

- For untrusted deployments, prefer **audio/video only**, and **disable `<object>` by default** (opt-in only).
- If `<object>` support is required, enforce:
  - strict MIME allowlist
  - strict URL policy
  - (ideally) sandboxed iframe instead of object for anything HTML-like

**Status**: **Addressed** (commit `a87ca31`) by making `<object>` embeds opt-in via security config.

## DoS considerations

### 4) Medium — XML/HTML parsing limits

- `parseXml()` historically did not reject `<!DOCTYPE ...>` explicitly and there were no size limits on `itemXml`. Even if modern parsers reduce entity expansion risks, untrusted inputs should still be preflighted to reduce DoS surface.
- `node-html-parser` is used for extraction and sanitization; large/deep inputs could be expensive.

#### Recommended remediations

Implemented (opt-in, compat-by-default) via `PlayerConfig.security.parsingLimits`:

- Reject `<!DOCTYPE` in `itemXml` (when enabled).
- Maximum sizes (configurable, enforced when enabled):
  - `maxItemXmlBytes` (UTF-8 byte length)
  - `maxHtmlBytes` (UTF-8 byte length for HTML strings passed to sanitizer)
- Guardrails (configurable, enforced when enabled):
  - `maxHtmlNodes` and `maxHtmlDepth` during sanitization traversal

## Processing/runtime code execution review

### 5) No dynamic JS eval in core processing (good)

No `eval`/`new Function` usage was found in the core processing path. The only intentional “code injection” surface is `PlayerConfig.customOperators`, which is integrator-provided by design and should be treated as trusted code.

### 6) Low — Prototype pollution & untrusted structured values

`record` baseType can parse JSON via `JSON.parse(...)`. Current cloning/merging patterns did not reproduce global prototype pollution in runtime tests, but hardening guidance:

- Avoid merging attacker-provided objects into global/shared objects.
- Prefer structured cloning where possible, or validate record shapes.

## Supply chain & CSP guidance

### 7) Medium — Runtime CDN load

`MathLiveEditor` injects a stylesheet from `cdn.jsdelivr.net` at runtime. This can:

- Break under strict CSP
- Add a supply-chain risk (no SRI/integrity pinning)

Recommendation:

- Prefer bundling CSS or making the URL configurable (and document the CSP requirements if it remains).

**Status**: **Addressed** (commit `a87ca31`) by making the CSS URL configurable (default remains `cdn.jsdelivr.net`).

### 8) CSP recommendations for same-DOM embedding (baseline)

Given `innerHTML`/`{@html}` usage, the host app should strongly consider:

- `object-src 'none'` (especially important with current `<object>` support)
- Tight `img-src` / `media-src` (restrict remote hosts; disallow `data:` unless explicitly required)
- `base-uri 'none'`
- `frame-src` and `child-src` restrictions if any iframe support exists
- Evaluate Trusted Types if you want defense-in-depth against DOM XSS (requires refactors and buy-in)

### 9) Trusted Types support (optional, defense-in-depth)

This project sanitizes QTI-derived HTML but still injects it into the DOM (`innerHTML` / Svelte `{@html ...}`).
For **strict CSP** deployments, the player can optionally emit `TrustedHTML` values so these sinks work under:

- `Content-Security-Policy: require-trusted-types-for 'script'; trusted-types <policyName> default;`

Enable it by passing:

- `security: { trustedTypesPolicyName: '<policyName>' }`

Notes:

- Trusted Types is **host-controlled**: it only has effect when the host enables it via CSP.
- This is **defense-in-depth**, not a sandbox. For strongest isolation of untrusted QTI, prefer **iframe mode**.

## Out of scope / trust boundary notes

- Plugins/custom interaction handlers/components run with full DOM access in the host app. This is an **integrator responsibility**. The framework should: (a) document the risk clearly, (b) provide optional helpers/strict mode, and (c) avoid making unsafe choices in core defaults.

## Recommended next steps

1) Add **DoS preflight limits** for untrusted inputs (reject `<!DOCTYPE`, enforce max lengths for `itemXml` and rendered HTML, and consider node-count limits).  
2) Expand **CSP/Trusted Types guidance** for integrators with copy/pastable CSP examples, and link to `docs/iframe-mode.md` as the recommended isolation approach for untrusted content.  
3) Keep monitoring supply chain + add periodic security regression tests as new render paths are introduced.
