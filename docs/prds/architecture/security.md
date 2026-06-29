# PRD: Security Model (sanitization, iframe isolation, Trusted Types)

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/item-player
  Last reviewed: 2026-04-27
-->

**Status:** draft  
**Type:** architecture  
**Packages:** `@pie-qti/item-player`  
**Last reviewed:** 2026-04-27

---

## Summary

`@pie-qti/item-player` renders QTI item XML — which may originate from untrusted third
parties — directly into the host application DOM. The security subsystem consists of four
interlocking layers: an HTML sanitizer that strips XSS vectors from QTI-derived markup, a
URL policy that restricts which schemes and hosts may appear in resource attributes, an
optional Trusted Types integration that lets the player emit `TrustedHTML` values for strict
CSP environments, and an iframe isolation mode that moves the entire item render into a
cross-origin sandbox. The layers are independently configurable via `PlayerSecurityConfig`.
Conservative defaults are active without any configuration; riskier capabilities require
explicit opt-in.

---

## Background and rationale

### Threat model

The highest-risk deployment is **same-DOM embedding**: the host page renders one or more QTI
items directly into its own DOM, and the item XML was authored by a third party or loaded
from an external content package. An attacker who can influence the XML content can attempt
DOM XSS via event-handler attributes, dangerous element types (`<script>`, `<iframe
srcdoc>`), and protocol-injection in URL attributes (`javascript:`, `data:text/html`).

The sanitizer and URL policy address this threat in the common case. They do not provide the
same isolation guarantee as a cross-origin iframe; for truly untrusted content the iframe
mode is the recommended deployment.

Plugins and custom interaction components run with full DOM access; they are an
**integrator-owned trust boundary**. The framework provides helpers and clear documentation
but does not attempt to sandbox integrator code.

### Why `srcdoc` is stripped even when `allowIframes=true`

`<iframe srcdoc="...">` embeds a full HTML document string. Even with a sanitized `src`, the
`srcdoc` attribute bypasses the URL policy entirely — an attacker can inject arbitrary HTML
and script into the iframe document. Setting `allowIframes=true` is intended to permit
well-known, host-trusted iframes (for example, embedded video players with known `src` URLs).
It does not constitute consent to allow arbitrary inline HTML documents. `srcdoc` is therefore
always removed regardless of `allowIframes`.

### Why `parsingLimits` defaults to disabled

The framework pre-dates the `parsingLimits` feature. Enabling limits by default would break
existing integrations that pass large `itemXml` payloads or deeply nested HTML content.
The limit defaults (10 MB XML, 5 MB HTML, 200 000 nodes, depth 200) were chosen to be
generous enough for all known legitimate QTI items while still protecting against pathological
inputs. Because the existing item corpus was not audited against these thresholds before
shipping, the feature is opt-in: integrators who process untrusted content should enable it
explicitly, and integrators who already have their own size/rate-limiting layer upstream may
find it redundant.

### Why origin locking on first valid message

`IFramePlayerHost` accepts an `allowedOrigins` list at construction time. When the first
valid protocol message arrives from an origin in that list, the host permanently locks to that
origin for the lifetime of the iframe. Subsequent messages from a different origin (even one
that is also in `allowedOrigins`) are rejected. This prevents a race condition where a
malicious frame on an allowed origin sends a forged `READY` after the legitimate runtime
frame has been loaded and its origin locked, or where a redirect inside the iframe could
change its effective origin mid-session.

### Why conservative defaults with opt-in relaxation

QTI content packages are used in K-12 assessments. A security failure in this context can
expose minors to arbitrary script execution on an assessment platform. Defaulting to the
most-restrictive safe behavior and requiring opt-in for anything beyond that means a
developer who forgets to configure security gets a working but restricted player, not an
exploitable one.

---

## QTI specification alignment

Not directly applicable. The security layer sits below the QTI rendering pipeline. The
sanitizer intentionally preserves all QTI-legal HTML content elements while removing
elements and attributes that have no legitimate use in QTI item bodies.

---

## Functional requirements

- **FR-1:** `sanitizeHtml` must remove all `<script>` elements.
- **FR-2:** `sanitizeHtml` must remove any attribute whose name matches `/^on/i`
  (case-insensitive), covering `onclick`, `onClick`, `oNLoAd`, and all other variants.
- **FR-3:** `sanitizeHtml` must remove the `srcdoc` attribute from any element regardless
  of `allowIframes` setting.
- **FR-4:** `sanitizeHtml` must remove `<iframe>`, `<object>`, and `<embed>` elements unless
  `allowIframes` / `allowObjectEmbeds` are set to `true` in `PlayerSecurityConfig`.
- **FR-5:** `sanitizeHtml` must remove `<base>`, `<meta>`, `<link>`, `<style>`, and
  `<foreignobject>` elements unconditionally.
- **FR-6:** `sanitizeHtml` must sanitize `src`, `href`, `xlink:href`, `data`, `action`,
  `formaction`, and `poster` attributes via `sanitizeResourceUrl`.
- **FR-7:** `sanitizeHtml` must sanitize `srcset` attributes by splitting on commas and
  sanitizing each candidate URL individually.
- **FR-8:** HTML comments must be stripped during parsing.
- **FR-9:** `sanitizeResourceUrl` must block `javascript:`, `vbscript:`, and `data:text/html`
  unconditionally.
- **FR-10:** `sanitizeResourceUrl` must block protocol-relative URLs (`//host/...`) by
  default; they may be explicitly allowed and will be rewritten to `https:` when allowed.
- **FR-11:** `sanitizeResourceUrl` must block `data:` for non-image contexts (`kind !=
  'img'`).
- **FR-12:** `sanitizeResourceUrl` must block `data:image/svg+xml` by default; opt-in via
  `allowSvgDataImages`.
- **FR-13:** `sanitizeResourceUrl` must block `http:` URLs by default; opt-in via
  `allowHttp`.
- **FR-14:** When `allowedHosts` is non-empty, `sanitizeResourceUrl` must reject any
  absolute URL whose hostname is not in the list.
- **FR-15:** When `parsingLimits.enabled` is `true`, `sanitizeHtml` must return `''` if the
  input exceeds `maxHtmlBytes` (UTF-8), if traversal exceeds `maxHtmlNodes`, or if traversal
  exceeds `maxHtmlDepth`.
- **FR-16:** When `parsingLimits.enabled` is `true`, `enforceItemXmlLimits` must throw if
  `itemXml` exceeds `maxItemXmlBytes` or contains a `<!DOCTYPE` declaration.
- **FR-17:** `toTrustedHtml(html, policyName)` must return a `TrustedHTML` value when
  Trusted Types is available and the policy name is found/created. It must fall back to the
  plain string when Trusted Types is unavailable.
- **FR-18:** `IFramePlayerHost` must reject incoming messages from origins not in
  `allowedOrigins`.
- **FR-19:** `IFramePlayerHost` must reject messages whose `event.source` is not the
  expected iframe's `contentWindow`.
- **FR-20:** `IFramePlayerHost` must lock to the first valid protocol message origin and
  reject subsequent messages from any other origin.
- **FR-21:** `IFramePlayerHost` must default `sandbox` to `'allow-scripts'` (no
  `allow-same-origin`) and `referrerPolicy` to `'no-referrer'`.
- **FR-22:** `IFramePlayerHost` must throw at construction if `allowedOrigins` is empty.
- **FR-23:** `isQtiIframeEnvelope` must reject any message where `protocol` is not
  `'pie-qti-iframe'` or `version` is not the current protocol version constant.

### Public shared-content API

`@pie-qti/item-player/security` exposes the sanitizer, URL policy, parsing-limit helpers, Trusted Types bridge, and `sanitizeSharedHtml(html, security?)` facade for QTI-derived shared content outside item bodies. Section-player and assessment-player shared passage, rubric, stimulus, and test-feedback render sinks must use this API instead of deep-importing `item-player/src/core/*`.

---

## Non-functional requirements

- **Accessibility:** Not directly applicable to the security layer; the sanitizer must
  preserve ARIA attributes (they are not `on*` attributes).
- **Performance:** `sanitizeHtml` runs synchronously on the main thread. For typical QTI
  item bodies (< 50 kB) it must complete in < 5 ms on a mid-range device. The `parsingLimits`
  byte-check short-circuits before parsing on oversized inputs.
- **Cross-platform:** The sanitizer uses `node-html-parser` which runs in both browser and
  server (SSR) contexts. `IFramePlayerHost` is browser-only and must not be imported in SSR
  contexts (it is excluded from the main package entrypoint for this reason).
- **Security:** No `eval` or `new Function` in the core rendering path (verified).
  `PlayerConfig.customOperators` is the only intentional eval-equivalent surface and is
  integrator-controlled trusted code.
- **i18n:** Not applicable.

---

## Deployment guidance (CSP and supply chain)

Sanitization and URL policy reduce DOM XSS risk in the common case, but same-DOM embedding of
untrusted QTI is ultimately an architectural exposure. Hosts that render untrusted content
should layer the following operational controls on top of the player's defaults; for fully
untrusted content, prefer iframe mode (`@pie-qti/item-player/iframe`).

### Content Security Policy

Because the player injects sanitized, QTI-derived HTML into the DOM (`innerHTML` /
`{@html ...}`), a host CSP provides valuable defense-in-depth:

- `object-src 'none'` — especially important if `allowObjectEmbeds` is enabled.
- Tight `img-src` / `media-src` — restrict remote hosts; disallow `data:` unless explicitly required.
- `base-uri 'none'` — prevents `<base>` from redirecting relative URLs.
- `frame-src` / `child-src` restrictions — apply when iframe support is enabled.

For strict deployments, enable Trusted Types via CSP and set a matching policy name through
`PlayerSecurityConfig.trustedTypesPolicyName`:

```text
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types <policyName>;
```

Trusted Types is host-controlled defense-in-depth, not a sandbox — it only takes effect when
the host enables it via CSP. For the strongest isolation of untrusted QTI, use iframe mode.

### Supply chain

`MathLiveEditor` loads a stylesheet from a CDN (`cdn.jsdelivr.net`) at runtime, which can
break under strict CSP and carries supply-chain risk (no SRI pinning). The CDN URL is
configurable; hosts with strict CSP should point it at a self-hosted/bundled stylesheet and
add the chosen origin to `style-src`.

### Untrusted structured values

The `record` baseType parses JSON via `JSON.parse`. Current cloning/merging patterns do not
reproduce global prototype pollution in tests, but hosts should avoid merging
attacker-provided objects into shared/global objects and prefer structured cloning or shape
validation for record values.

---

## Design decisions

### Case-insensitive `on*` attribute removal

**Decision:** Remove any attribute matching `/^on/i` rather than a fixed allowlist of
lower-case names.  
**Rationale:** Pre-`a87ca31`, the sanitizer used a fixed list of lower-case names checked
with exact equality. `node-html-parser` preserves attribute casing, so `onClick` and
`oNLoAd` were silently passed through. The case-insensitive prefix check is both simpler
and complete by construction; there is no finite list of event handler names.  
**Alternatives considered:** Normalizing all attribute names to lowercase before checking;
using DOMPurify.  
**Consequences:** Any attribute whose name legitimately starts with `on` (there are none in
standard HTML) would also be stripped. This is an acceptable false-positive rate.

### `srcdoc` unconditionally removed

**Decision:** `srcdoc` is stripped before any other URL or iframe check.  
**Rationale:** `srcdoc` is an HTML document string that bypasses the URL policy. Even a
perfectly policy-compliant `srcdoc` value would still allow arbitrary HTML structure inside
the iframe. The `allowIframes` flag controls whether the iframe element itself is kept; it
does not grant the right to embed inline HTML documents.  
**Alternatives considered:** Sanitizing the `srcdoc` value recursively. Rejected because the
recursion boundary is hard to define and the attack surface remains large.  
**Consequences:** Integrators who need srcdoc for legitimate reasons (e.g. custom math
rendering sandboxes) must use an iframe with a real URL instead.

### URL policy as a first-class config object

**Decision:** URL rules live in `UrlPolicyConfig` passed through `PlayerSecurityConfig`,
applied uniformly to both the HTML sanitizer and extracted URL fields.  
**Rationale:** Before the URL policy was introduced, each component bound resource URLs
directly to DOM attributes without any sanitization. The central policy ensures consistent
treatment across all URL-bearing contexts and provides a single place for integrators to
configure their rules.  
**Alternatives considered:** Per-component URL filtering; hard-coded allow/deny lists.  
**Consequences:** The policy object must be threaded through the entire extraction and
rendering pipeline. Components that bind URLs must call `sanitizeResourceUrl` rather than
using the raw value.

### `data:image/svg+xml` blocked by default

**Decision:** SVG data URIs are blocked unless `allowSvgDataImages: true`.  
**Rationale:** SVG can contain `<script>` elements and event handlers. A `data:image/svg+xml`
value in an `<img src>` triggers passive rendering in most browsers today, but SVG's
script-execution behavior under different contexts has historically been a source of bypasses.
The conservative default avoids relying on browser-version-specific behavior.  
**Alternatives considered:** Allow all `data:image/*` uniformly.  
**Consequences:** Items that legitimately embed SVG diagrams as data URIs will have those
images blocked unless the integrator opts in.

### `parsingLimits` disabled by default

**Decision:** `parsingLimits.enabled` defaults to `false`; limits apply only when explicitly
set to `true`.  
**Rationale:** Enabling limits retroactively would break existing integrations that pass
large items or deeply nested content. The limit defaults were sized for safety, not for
compatibility with the full production item corpus. Opt-in allows staged rollout.  
**Alternatives considered:** Enable by default with high thresholds; add a migration path.  
**Consequences:** Applications processing untrusted QTI must explicitly enable limits.
Documentation must make this prominent.

### Trusted Types as opt-in defense-in-depth

**Decision:** The player only emits `TrustedHTML` when `trustedTypesPolicyName` is set in
`PlayerSecurityConfig` and Trusted Types is supported by the browser.  
**Rationale:** Trusted Types requires CSP opt-in at the host application level. Emitting
`TrustedHTML` unconditionally in non-TT environments would break sinks that expect `string`.
The player cannot know whether the host has enabled TT without the config.  
**Alternatives considered:** Auto-detect TT support and always wrap. Rejected because TT
policy creation can be blocked by CSP and would throw unexpectedly.  
**Consequences:** Trusted Types protection requires coordinated opt-in from both the host CSP
and the `PlayerSecurityConfig`. See the deployment guidance above (CSP and Trusted Types).

### Origin locking on first valid message

**Decision:** `IFramePlayerHost` locks to the first valid protocol message origin for the
session lifetime.  
**Rationale:** Allows the `allowedOrigins` list to contain multiple development origins
(localhost ports, staging domains) without enabling any of them to inject messages after
the runtime has been established. Prevents a second frame on an allowed origin from racing
the legitimate runtime.  
**Alternatives considered:** Accept all origins in `allowedOrigins` for all messages for
the lifetime. Rejected as weaker.  
**Consequences:** If the iframe runtime legitimately migrates to a different origin mid-session
(e.g. redirect), the host will stop accepting its messages. This scenario should not arise in
practice; if it does, the host must be destroyed and recreated.

### iframe sandbox defaults to `allow-scripts` only

**Decision:** The default `sandbox` value excludes `allow-same-origin`.  
**Rationale:** Including `allow-same-origin` in a same-origin iframe removes the isolation
boundary: the runtime JS can access `window.parent` and the host DOM directly. The
conservative default forces integrators to consciously add `allow-same-origin` if they need
it, understanding the implication.  
**Alternatives considered:** Default to `allow-scripts allow-same-origin`; require callers
to set sandbox explicitly.  
**Consequences:** An opaque-origin iframe (`allow-scripts` without `allow-same-origin`) means
`event.origin` will be `"null"` in some browsers. Integrators who rely on origin matching in
the runtime must either set `allow-same-origin` or allow `"null"` as an origin — which is
documented as not recommended for production.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|---|---|---|---|
| Custom URL policy | `UrlPolicyConfig` | Pass via `PlayerConfig.security.urlPolicy`. | `{ allowHttps: true, allowedHosts: ['cdn.myorg.com'] }` |
| Object/embed allow | `PlayerSecurityConfig.allowObjectEmbeds` | Set `true` to permit `<object>` and `<embed>` elements. | `security: { allowObjectEmbeds: true }` |
| Iframe allow | `PlayerSecurityConfig.allowIframes` | Set `true` to permit `<iframe>` elements (srcdoc always stripped). | `security: { allowIframes: true }` |
| Trusted Types | `PlayerSecurityConfig.trustedTypesPolicyName` | Set to a CSP-allowed policy name; the player will create and use it. | `security: { trustedTypesPolicyName: 'pie-qti' }` |
| Parsing limits | `ParsingLimitsConfig` | Enable and configure via `PlayerConfig.security.parsingLimits`. | `security: { parsingLimits: { enabled: true, maxItemXmlBytes: 1_000_000 } }` |
| Iframe host | `IFramePlayerHost` | Import from `@pie-qti/item-player/iframe` (browser-only subpath). | See `packages/item-player/docs/iframe-mode.md` |
| Custom iframe sandbox | `IFramePlayerHostConfig.sandbox` | Override the sandbox attribute string. | `sandbox: 'allow-scripts allow-same-origin'` |

---

## Data model / contracts

### `PlayerSecurityConfig`

Defined in `packages/item-player/src/types/index.ts`.

Key invariants:
- All fields optional; omitting the entire `security` key is equivalent to
  `{ allowObjectEmbeds: false, allowIframes: false }` with the default URL policy.
- `urlPolicy.allowHttp` defaults to `false`; `allowHttps` to `true`.
- `urlPolicy.allowDataImages` defaults to `true` (data images are common in QTI); 
  `allowSvgDataImages` defaults to `false`.
- `urlPolicy.allowProtocolRelative` defaults to `false`.
- `parsingLimits.enabled` defaults to `false`.
- `trustedTypesPolicyName` has no default; TT wrapping is inactive when absent.

### `ParsingLimitsConfig` defaults (when enabled)

| Limit | Default value |
|---|---|
| `maxItemXmlBytes` | 10 000 000 (10 MB) |
| `maxHtmlBytes` | 5 000 000 (5 MB) |
| `maxHtmlNodes` | 200 000 |
| `maxHtmlDepth` | 200 |
| `rejectDoctype` | `true` |

### iframe protocol versioning

The protocol version is `'0.1.0'` (constant `QTI_IFRAME_PROTOCOL_VERSION`). Both host and
runtime must agree on the version; `isQtiIframeEnvelope` rejects messages from a different
version. When the protocol needs a breaking change, bump the version constant and update
both the host helper and the reference runtime together.

### `QtiIframeEnvelope` shape

```ts
{
  protocol: 'pie-qti-iframe';   // discriminator, always literal
  version:  '0.1.0';            // currently the only accepted version
  requestId?: string;           // correlates request/response pairs
  type: QtiIframeMessageType;   // 'READY' | 'INIT' | 'SET_RESPONSES' | ...
  payload: unknown;             // shape is per-type (see protocol.ts)
}
```

`parseQtiIframeMessage` returns `null` for anything that fails the envelope check.
Downstream handlers receive a typed `QtiIframeMessage` discriminated union; they should
still validate payload fields before use, as the envelope check is intentionally shallow.

---

## Acceptance criteria

### Functional

```
AC-1: Mixed-case event handler removal
  Given: A call to sanitizeHtml('<p onClick="alert(1)" oNLoAd="alert(2)">text</p>')
  When: No security options are passed
  Then: The output contains neither "onClick" nor "oNLoAd" nor "alert"

AC-2: srcdoc stripped when allowIframes=true
  Given: A call to sanitizeHtml('<iframe src="https://example.com" srcdoc="<img src=x onerror=alert(1)>"></iframe>')
  When: security.allowIframes=true is passed
  Then: The output contains the iframe element
  And:  The output does NOT contain "srcdoc"

AC-3: srcdoc stripped when allowIframes=false (default)
  Given: A call to sanitizeHtml('<iframe srcdoc="<script>alert(1)</script>"></iframe>')
  When: No security options are passed
  Then: The output contains no iframe element at all

AC-4: javascript: URL blocked
  Given: A call to sanitizeHtml('<a href="javascript:alert(1)">click</a>')
  When: No security options are passed
  Then: The href attribute value is replaced (e.g. '#') and does not contain "javascript:"

AC-5: data:text/html URL blocked
  Given: A call to sanitizeResourceUrl('data:text/html,<script>alert(1)</script>', undefined, 'any')
  When: Called directly
  Then: Returns null

AC-6: data:image/png allowed for img kind
  Given: A call to sanitizeResourceUrl('data:image/png;base64,abc', { allowDataImages: true }, 'img')
  When: Called directly
  Then: Returns the original data URI string

AC-7: data:image/svg+xml blocked by default
  Given: A call to sanitizeResourceUrl('data:image/svg+xml,...', { allowDataImages: true }, 'img')
  When: allowSvgDataImages is not set (default false)
  Then: Returns null

AC-8: data:image/svg+xml allowed when opt-in
  Given: A call to sanitizeResourceUrl('data:image/svg+xml,...', { allowDataImages: true, allowSvgDataImages: true }, 'img')
  When: Called
  Then: Returns the original URI

AC-9: protocol-relative URL blocked by default
  Given: A call to sanitizeResourceUrl('//cdn.evil.com/tracker.png', undefined, 'img')
  When: Called
  Then: Returns null

AC-10: Host allowlist enforced
  Given: A call to sanitizeResourceUrl('https://evil.com/img.png', { allowedHosts: ['cdn.trusted.com'] }, 'img')
  When: Called
  Then: Returns null

AC-11: Host allowlist passes trusted host
  Given: A call to sanitizeResourceUrl('https://cdn.trusted.com/img.png', { allowedHosts: ['cdn.trusted.com'] }, 'img')
  When: Called
  Then: Returns 'https://cdn.trusted.com/img.png'

AC-12: parsingLimits maxHtmlBytes enforced
  Given: parsingLimits.enabled=true, maxHtmlBytes=100
  When: sanitizeHtml is called with a string longer than 100 UTF-8 bytes
  Then: Returns ''

AC-13: parsingLimits maxHtmlNodes enforced
  Given: parsingLimits.enabled=true, maxHtmlNodes=5
  When: sanitizeHtml is called with HTML containing 10 elements
  Then: Returns ''

AC-14: enforceItemXmlLimits rejects DOCTYPE
  Given: parsingLimits.enabled=true, rejectDoctype=true
  When: enforceItemXmlLimits('<!DOCTYPE foo><assessmentItem.../>', security) is called
  Then: Throws an error mentioning DOCTYPE

AC-15: enforceItemXmlLimits does nothing when disabled
  Given: No security config (parsingLimits.enabled defaults to false)
  When: enforceItemXmlLimits is called with oversized XML containing DOCTYPE
  Then: Does not throw

AC-16: IFramePlayerHost rejects unknown origin
  Given: An IFramePlayerHost configured with allowedOrigins=['https://runtime.example']
  When: A MessageEvent arrives from 'https://attacker.example'
  Then: The message is silently ignored; no host event is emitted

AC-17: IFramePlayerHost rejects correct-origin but wrong-source message
  Given: An IFramePlayerHost configured with allowedOrigins=['https://runtime.example']
  When: A MessageEvent from 'https://runtime.example' arrives but event.source is NOT the iframe's contentWindow
  Then: The message is silently ignored

AC-18: IFramePlayerHost origin locking
  Given: An IFramePlayerHost configured with allowedOrigins=['https://a.example', 'https://b.example']
  When: The first valid protocol message arrives from 'https://a.example'
  And:  A subsequent valid protocol message arrives from 'https://b.example'
  Then: The second message is silently ignored; no host event is emitted for it

AC-19: IFramePlayerHost empty allowedOrigins throws
  Given: Constructing IFramePlayerHost with allowedOrigins=[]
  Then: The constructor throws immediately

AC-20: IFramePlayerHost default sandbox excludes allow-same-origin
  Given: An IFramePlayerHost constructed without explicit sandbox option
  When: The iframe element is inspected
  Then: iframe.sandbox does not contain 'allow-same-origin'
  And:  iframe.sandbox contains 'allow-scripts'

AC-21: Trusted Types wrapping returns string when TT unavailable
  Given: A browser/runtime without Trusted Types (globalThis.trustedTypes is undefined)
  When: toTrustedHtml('<p>safe</p>', 'pie-qti') is called
  Then: Returns the plain string '<p>safe</p>'
```

### Accessibility

```
AC-A1: ARIA attributes preserved by sanitizer
  Given: A call to sanitizeHtml('<div aria-label="question 1" role="group">...</div>')
  When: No security options are passed
  Then: The output preserves aria-label and role attributes unchanged
  Notes: ARIA attributes do not start with 'on'; they must not be stripped.
```

### Edge cases

```
AC-E1: Empty string input to sanitizeHtml returns empty string
  Given: sanitizeHtml('')
  Then: Returns ''

AC-E2: Non-string input to sanitizeHtml returns empty string
  Given: sanitizeHtml(null as any)
  Then: Returns ''

AC-E3: Relative URLs preserved when no assetBaseUrl
  Given: sanitizeResourceUrl('./images/diagram.png', undefined, 'img')
  Then: Returns './images/diagram.png'

AC-E4: Relative URL resolved when assetBaseUrl provided
  Given: sanitizeResourceUrl('./images/diagram.png', { assetBaseUrl: 'https://cdn.org/items/abc/' }, 'img')
  Then: Returns 'https://cdn.org/items/abc/images/diagram.png'

AC-E5: srcset with mixed valid and invalid URLs
  Given: sanitizeHtml('<img srcset="https://cdn.ok/a.png 1x, javascript:void(0) 2x">')
  Then: The output srcset contains only 'https://cdn.ok/a.png 1x'; the javascript: candidate is removed

AC-E6: Protocol envelope version mismatch rejected
  Given: An IFramePlayerHost running protocol version '0.1.0'
  When: A postMessage arrives with { protocol: 'pie-qti-iframe', version: '0.0.1', type: 'READY', payload: {} }
  Then: parseQtiIframeMessage returns null; the host ignores the message
```

---

## Open questions

- [ ] Should `sanitizeHtml` accept a MathML allowlist so MathML elements are preserved when
  the player is configured with a MathML renderer? Currently MathML elements that are not in
  the element removal list pass through; explicit allowlisting would make the behavior
  deterministic.
- [ ] Should `IFramePlayerHost` support `'null'` as an allowed origin for opaque sandboxes,
  with a documented caveat? Currently integrators must manage this themselves.
- [ ] Is the `parsingLimits` depth-200 default sufficient for deeply nested table/list
  structures in QTI rubric content? This has not been profiled against the production item
  corpus.

---

## Related

- Iframe mode reference: `packages/item-player/docs/iframe-mode.md`
- Implementation: `packages/item-player/src/core/sanitizer.ts`, `urlPolicy.ts`,
  `trustedTypes.ts`, `parsingLimits.ts`
- Iframe host + protocol: `packages/item-player/src/iframe/IFramePlayerHost.ts`,
  `packages/item-player/src/iframe/protocol.ts`
- Types: `packages/item-player/src/types/index.ts` (`PlayerSecurityConfig`,
  `UrlPolicyConfig`, `ParsingLimitsConfig`)
- Adjacent PRDs: `architecture/item-player.md`
