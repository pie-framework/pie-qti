# PCI Runtime Engine and Sandbox Plan

**Status**: Proposed
**Last reviewed**: 2026-08-17
**Scope**: `packages/item-player/src/pci/`,
`packages/item-player/src/interactions/portable-custom/`,
`packages/item-player/src/iframe/`,
`packages/default-components/src/plugins/portable-custom/`

Turns Portable Custom Interaction support from a host-gated escape hatch into a
spec-conformant runtime, and decides where PCI code executes. The interaction
PRD in [`../prds/interactions/custom.md`](../prds/interactions/custom.md)
describes current behavior; this plan covers what changes and in what order.

---

## Position

Extraction and player integration are complete. `portableCustomExtractor`
handles QTI 3.0 `qti-portable-custom-interaction` and the QTI 2.x
`pci:portableCustomInteraction` wrapper; `PciHost` owns the
load/initialize/response/disable/destroy lifecycle; the renderer mounts a
sanitized scaffold and wires responses into the item session. Execution is
gated on `PciConfiguration.moduleResolver`, an explicit host trust decision,
and resolved modules run in the page realm with page authority.

The gap is not the resolver. It is the module contract.

---

## Contract Divergence

`PciModule` is a bespoke interface. QTI 3.0 PCI specifies a registry-based
contract: a module calls `qtiCustomInteractionContext.register(pci)` with a
`typeIdentifier` and a `getInstance(dom, configuration, state)` factory; the
instance signals readiness through `configuration.onready(instance, state)` and
completion through `configuration.ondone(...)`, and exposes `getResponse()` and
`getState()`. AMD is the documented default module resolution, with a
resolution-config file format and a defined fallback-resolution path.

| Concern | Current | Specified |
| ------- | ------- | --------- |
| Module discovery | Default export or named `getInstance` export | `qtiCustomInteractionContext.register()` against a runtime-owned global |
| Instantiation | `initialize(dom, config, boundTo)` | `getInstance(dom, configuration, state)` |
| Readiness | `boundTo.onReady()` | `configuration.onready(instance, state)` |
| Completion | none | `configuration.ondone(...)` |
| `boundTo` | Player callback bag | The bound response-variable object |
| Response value | Raw `unknown` | QTI variable JSON (`base` / `list` / `record`) |
| Restore | `setResponse(value)` | `state` argument to `getInstance`, read back via `getState()` |
| Configuration | `Record<string, string>` from `qti-pci-properties` | `properties` plus `templateVariables`, `contextVariables`, `status`, `responseIdentifier` |
| Module loading | Host resolver returns an ES module | AMD default resolution, resolution-config file, fallback resolution |
| Module declarations | One `primary-path` / `fallback-path` pair | Multiple `qti-interaction-module` entries with `id`, plus `module-resolution-config` |

The consequence is portability in exactly the direction PCI exists to prevent:
a PCI authored against the specification does not run here, and one authored
against `PciModule` runs nowhere else. Any official PCI test content fails at
module registration, before sandboxing is even reachable.

The divergence was unintended, so `PciModule` is replaced outright rather than
adapted. The project is pre-1.0 and carries no compatibility obligation to it;
no legacy contract, adapter, or dual-acceptance path is kept.

Scope is narrower than the table suggests. Extraction, the renderer, session
wiring, the resolver trust gate, and QTI value conversion all survive. What
changes is the module-facing contract at three points — module discovery,
response ownership, and interaction status — plus a module loader.

---

## Blast Radius

Nothing that executes today. PCI execution requires
`PciConfiguration.moduleResolver`, no consumer in the workspace supplies one, and
`renaissance-pie-qti-extensions` carries no PCI references at all. The
`moduleResolver` in `pie-elements-ng`'s element loader is an unrelated
`ElementModuleResolver` for PIE element modules.

Authored content is unaffected: extraction is unchanged, so spec-shaped
`qti-portable-custom-interaction` XML keeps parsing and rendering its scaffold.

The break is the published type surface. `@pie-qti/item-player` exports
`PciModule`, `PciBoundTo`, `PciHost`, `PciHostController`, `PciHostOptions`,
`PciModuleResolver`, `PciModuleResolutionContext`, `PciConfiguration` and
`PciModulePathKind`, plus a `./pci` subpath, and most change shape.
`PciConfiguration` stays `{ baseUrl?, moduleResolver }`, so the `.pci` property on
the custom elements is stable. Any module written against `PciModule` breaks
outright; none is known to exist, since running one requires a resolver nobody
ships.

Composer is unaffected. It pins `@pie-qti/*@0.1.22`, imports no `Pci*` type,
assigns no `.pci` property, and supplies no resolver. Its only PCI awareness is
in the corpus-triage CLI, which classifies PCI and `customInteraction` items as
`manual_only` against the `pie-qti-custom` fallback component — a classification
this work does not change, since the fallback path is untouched.

---

## Runtime Engine

**Decision:** `PciHost` remains the player-facing controller and gains a
spec-facing runtime beneath it that owns the registry global and module
loading. The player keeps one seam; the spec contract lives on the far side of
it.

**Module discovery** becomes registry observation. The runtime installs
`qtiCustomInteractionContext` before the resolver evaluates the module and reads
the registration afterward, replacing the six-method duck-type in
`PciHost.extractPciInterface`. The resolver's signature does not change and its
return value stops mattering: a host that imports an allow-listed URL keeps
working, because a conformant module registers as a side effect of evaluation.
The trust gate is unaffected — the loader decides *how* a module is evaluated,
the resolver still decides *whether*.

**Response representation** becomes QTI variable JSON at the runtime boundary.
`Player.qtiValueToPublic` already produces and recurses through `base`/`list`/
`record` values and the PCI seam currently uses it to convert *away* from the
shape the spec wants, so this is a deletion at the boundary rather than new
machinery. `boundTo` reverts to its specified meaning — the bound
response-variable object — and the current callback bag becomes runtime-internal.

**Response ownership** is the substantive change, and it is a correction rather
than a migration cost. `getInstance(dom, configuration, state)` is the only state
injection point the spec defines and there is no setter, which encodes an
invariant worth having independently: a mounted interaction owns its response
until it reports one. The player currently treats the response map as
authoritative and pushes downward — right for declarative Svelte components,
wrong for a stateful third-party module.

The three `Player.ts` push sites are three intents collapsed into one method, not
three timings of one operation:

| Site | Intent |
| ---- | ------ |
| `setResponses` | External hydration |
| `resetResponsesToDefault` | Reset to declaration default |
| `applySerializedVariables` | Session deserialization |

All three transfer authority *into* the item and none of them represents
candidate action, so re-instantiation is the correct response to all three.

**Decision:** hosts are constructed with their initial state and status instead
of being constructed empty and pushed into. The renderer's reactive
`setResponse` becomes a keyed remount. The three hydration sites mark a host
dirty for re-instantiation on next render rather than mutating a live module.

The ownership half of this landed ahead of the contract migration, because it
fixed a live defect rather than a migration cost. `ItemSession.dispatch({ action:
'setResponse' })` — the path every candidate change takes, a PCI's own reports
included — calls `Player.setResponses`, which pushed straight into
`PciHost.setResponse` with no dirty check. Every response a module reported was
handed back to it immediately, rebuilding whatever internal state the module
derived from it, and the renderer's reactive `response` prop carried a second
copy of the same loop.

`PciHost.setResponse` is now `hydrate()` (declined while the module owns the
response) and `restore()` (authoritative, returns ownership), with
`setResponses(responses, { authoritative: true })` as the host escape hatch.
Rebuild-on-restore landed with it: `restore()` on a mounted module fires
`onReinitializeRequest`, and the renderer — which owns scaffold sanitization —
resets the markup and calls `remount(dom)`, discarding the previous instance,
resolving a fresh one, and seeding the restored value. Phase 1 changes only the
seeding call inside `initialize()`, from `setResponse` to state passed at
`getInstance`.

**Interaction status** replaces `disable()`/`enable()` under the same rule.
`configuration.status` (`interacting`, `closed`, `solution`, `review`) is fixed at
instantiation, while `Player.syncPciDisabledState()` flattens `role !==
'candidate'` into a boolean. Deriving status from role plus attempt and feedback
state — all of which the player already tracks — is both conformant and a
capability gain: a boolean cannot distinguish `review` from `solution`, so
today's player has no way to tell a PCI to show the solution. Keep
`disable`/`enable` only as optional methods the runtime calls when a module
happens to expose them.

**Module loading** goes behind a loader seam with two implementations: AMD for
the specified default resolution, ESM for direct imports. Selection follows the
authored `module-resolution-config` when present. The AMD `define`/`require`
implementation is new code required by the specification, not an accommodation
of anything legacy.

**Extraction** grows to carry multiple `qti-interaction-module` entries with
their `id`s and the `module-resolution-config` reference. `ExtractedPci` becomes
a module list rather than a path pair.

---

## Execution Realm

`getResponse()` is synchronous in the specified contract. Every isolation
boundary that is also a realm boundary makes it asynchronous, so a sandboxed
engine must answer `getResponse()` from a cache maintained by `ondone` pushes
and state reads. Response freshness at submit time becomes a protocol
obligation rather than a function call — this is the constraint that decides
between the options below, not the sandbox syntax.

Relative asset resolution is the second constraint: a PCI that loads its own
images or data files expects them relative to its module path. A sandboxed frame
loaded from a real URL keeps that working — an opaque origin removes
origin-derived authority, not base-URL resolution — so the runner needs the
package base URL passed in at init, not a manifest proxy.

### Option A — Page realm

Current behavior. PCI code holds page authority; the host resolver is the only
gate, and `createAllowlistPciModuleResolver` now supplies that gate's origin and
prefix policy so each host does not reimplement it. Synchronous `getResponse()`
works. Zero isolation: a hostile PCI reads the session, the DOM, and any host
credentials in the realm — an allow-list constrains *which* code runs, never what
it can do once running.

Correct for first-party and contractually-trusted PCIs, which is the common
case in a K-12 item bank the delivery platform also authors.

### Option B — Whole-player cross-origin iframe

Exists today as `@pie-qti/item-player/iframe`. `IFramePlayerHost` locks to the
first valid protocol message origin, rejects messages whose `event.source` is
not the frame's `contentWindow`, requires a non-empty `allowedOrigins`, and
defaults `sandbox` to `allow-scripts` without `allow-same-origin`.

Coarse but already built and already the documented answer for untrusted
content. The trade: isolation is all-or-nothing per item, and the host loses
direct DOM access to everything, not just the PCI.

### Option C — Per-PCI sandboxed iframe from a cookieless runner origin

`<iframe sandbox="allow-scripts" src="https://<runner-origin>/pci-runner.html">`
— a real URL *and* the sandbox attribute, not one or the other. Without
`allow-same-origin` the document's origin is opaque, so it shares no storage,
cookies or DOM with the player, while its base URL remains the URL it loaded
from, so authored relative asset paths still resolve. The rest of the item stays
in the page realm.

Requirements:

- `allow-scripts` alone. A frame carrying `allow-scripts` *and*
  `allow-same-origin` can strip its own sandbox attribute.
- A runner origin that serves nothing else and sets no cookies. There is nothing
  on it worth reaching, which is the security property; per-tenant subdomains are
  unnecessary because each frame already has a distinct opaque origin.
- A PCI-side runner implementing `qtiCustomInteractionContext` and bridging the
  contract over `postMessage`. The existing `pie-qti-iframe` protocol is the
  model: versioned envelopes, origin locking, `resize` and `responseChange`
  already exist in the shape this needs.
- Mutual origin locking over `postMessage`. `frame-ancestors` is ignored in
  `<meta>` CSP, so who may frame the runner cannot be enforced by header on a
  static host; the runner verifies `event.origin` against a value passed at init,
  as `IFramePlayerHost` already verifies the frame.
- `Access-Control-Allow-Origin: *` without credentials on the package origin. An
  opaque origin sends `Origin: null`, so a PCI using `fetch` needs it; `<img>`
  and `<script>` loads need no CORS at all.

Accepted limits: no storage and no cookies in the frame, so a PCI that persists
locally or fetches authenticated assets breaks. Neither should happen under the
specification, where state travels through `getState()`, but third-party code
will do both.

`https://qti.pie-framework.org` satisfies the runner-origin requirements today,
including for production, since it is a distinct cookieless origin serving static
content. Its inability to set response headers costs only `frame-ancestors`,
which the origin-locking protocol covers.

### Option D — Retired

Previously "per-PCI iframe on a dedicated sandbox origin", listed as stronger
isolation than Option C. It is not a separate tier: a dedicated origin is a
property of Option C, and the objection that motivated D — tenants sharing
storage on one named origin — dissolves under sandboxing, which denies storage
outright. Folded into Option C's requirements.

### Option E — Worker or ShadowRealm

Rejected. PCIs render; both boundaries deny DOM access.

**Decision:** Option A stays the default for first-party and contractually
trusted PCIs. Option B stays the documented answer for wholly untrusted items.
Option C is the opt-in hardened engine for third-party PCIs delivered alongside
trusted item content.

---

## Sequencing

1. **Spec contract adoption.** Registry global, `getInstance`, `onready` /
   `ondone`, QTI variable JSON responses, `getState()` restore. Third-party PCIs
   run after this phase and not before it.
2. **AMD loader and module resolution.** Loader seam, AMD default resolution,
   resolution-config parsing, fallback resolution, multi-module extraction.
3. **Conformance evidence.** Clean-room PCI fixtures exercising registration,
   restore-by-state, `ondone`, and fallback resolution; browser-level evidence
   in the private runner.
4. **Sandboxed engine (Option C).** Frame runner, bridged contract, cached
   response reads, base-URL asset resolution, mutual origin locking.

Phases 1–3 make third-party PCIs playable, which is the driver. Phase 4 is a
security posture and does not gate anything else.

---

## Driver: Ingest, Not Portability

The reason to do this is inbound content. Composer's corpus triage classifies PCI
and `customInteraction` items as `manual_only` against the fallback component, so
packages already arriving from third-party sources carry PCIs the pipeline cannot
play. Phases 1–3 close that; nothing about them depends on a certification claim.

PCI certification is therefore a data-driven decision rather than a positioning
one. The corpus triage already counts how often ingested packages carry PCIs: if
that frequency is negligible, do phases 1–3 for ingest quality and skip the claim;
if it is not, the claim follows from work already done. Official suite commit
`b058156` ships no PCI packages while Cito holds Delivery-PCI and Import-PCI, so
scope the test-content source with 1EdTech before committing either way.
Submission strategy lives in the private conformance project.

---

## Principal Risk

No conformance oracle. Official suite commit `b058156` ships no PCI packages, so
phases 1 and 2 are implemented against specification prose with no official
content to check against, and the first authoritative feedback arrives from
1EdTech during a submission. Mitigate by testing against a third-party PCI
authored to the specification rather than only against clean-room fixtures
written from the same reading of the spec that produced the implementation.

## Decisions Closed

**PIE Elements are not projected into the PCI contract** (2026-08-17). Exposing
each PIE Element as a conformant PCI module would make the PIE catalogue portable
to third-party players, and `@pie-qti/pie-to-qti2` would emit
`qti-portable-custom-interaction` where it currently emits an opaque QTI 2.x
`customInteraction` that no other player can run.

Rejected because it complicates PIE for a benefit PIE does not need. Distribution
is already solved by CDN-loaded web components sharing a `pie-context` singleton —
the coupling that forced the lockstep `@pie-players/*` pin — and a PCI module must
be self-contained JavaScript at a URL inside the package, so projection would
duplicate that shared runtime in every module of every package. The payoff is
third-party players consuming Renaissance content, which is not a current need:
Composer reads QTI and does not publish it.

This closes only the outbound direction. PCI *host* support is unaffected and
proceeds on the ingest driver above; the two were being conflated.

**Sandbox origin: `https://qti.pie-framework.org`** (2026-08-17). Satisfies
Option C's runner-origin requirements — distinct, cookieless, static. Not being
able to set response headers costs only `frame-ancestors`, which mutual origin
locking covers.

---

## Related

- Interaction PRD: [`../prds/interactions/custom.md`](../prds/interactions/custom.md)
- Security model PRD: [`../prds/architecture/security.md`](../prds/architecture/security.md)
- Spec gap G-08: [`../SPEC-GAPS-PLAN.md`](../SPEC-GAPS-PLAN.md)
- QTI reference: [`../QTI_techguide.md`](../QTI_techguide.md) §6.1
