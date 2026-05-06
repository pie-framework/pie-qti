# QTI 3 Remaining Parity Evidence Matrix

This matrix tracks the remaining QTI 3 parity work against public clean-room
evidence, package contracts, private conformance follow-up, and review gates.
It is intentionally feature-oriented rather than source-oriented: sibling
`qti3-*` projects may inform behavior, but public fixtures and implementation
language must remain QTI 3.0 or `pie-qti` terminology.

## Source-Leakage Boundary

- Do not copy source code, fixture XML, test names, fixture directory shapes,
  comments, CSS selectors, screenshots, proprietary identifiers, README prose,
  or API/event names from sibling `qti3-*` projects or private conformance
  assets.
- Every public fixture must record clean-room provenance in the test or fixture
  metadata: authoring intent, QTI feature covered, and why it is not derived
  from official/private assets.
- When private conformance reveals a failure, describe the public follow-up as
  a feature-level behavior such as "section maxTime expiry was not enforced",
  not as an official package path, raw XML snippet, screenshot, or log excerpt.

## Certification Boundary

- Public coverage in this repository uses only clean-room fixtures, public
  examples, generated test assets, and `bun run test:certification:public`.
- Official 1EdTech XML, ZIPs, screenshots, and raw private conformance logs
  belong only in the private `../pie-qti-conformance` project.
- Private conformance findings may be brought back only as sanitized
  feature-level failures, with new or updated clean-room public fixtures.
- A private conformance run is valid for this repo only after affected
  `@pie-qti/*` packages are published and `../pie-qti-conformance` consumes
  the published versions.

## Review Gate Pattern

Each implementation stage gets a first code pass, deterministic evidence, and
then three independent reviews:

- QTI/spec behavior review.
- Architecture/security review.
- Accessibility/test/leakage review.

Confirmed findings are fixed before advancing to the next stage. Review
subagents are supplemental; unit, integration, browser, public certification,
and private conformance evidence remain the gates.

## Stage Order And Exit Criteria

| Stage | Prerequisites | Public API contract | Evidence gate | Criteria to advance |
| --- | --- | --- | --- | --- |
| 1. Resolved delivery context | Stage 0 accepted | Additive optional config/state only; keep `catalogXml` compatible | Resolution unit tests and public matrix updates | Per-item context resolves package bases, controls, time limits, stimulus refs, catalogs, and styles without item-player package traversal |
| 2. Time limits and enforcement | Stage 1 context model | Additive optional backend timing fields unless a breaking API plan is separately approved | Timing precedence and backend adapter tests | Item/section/test elapsed state restores, expires, and submits consistently with `allowLateSubmission` and extended time |
| 3. PNP/catalog/security | Stage 2 timing model for extended-time application | Additive `PnpProfile`, catalog, and event detail fields | PNP parser/apply tests, catalog tests, sanitizer/URL-policy tests | Dynamic PNP rebinding is idempotent and no inactive support emits UI or events |
| 4. Shared stimulus runtime | Stage 1 context and Stage 3 security policy | Additive resolved stimulus/catalog/style inputs | Parser plus renderer integration tests | Item and shared stimulus bodies, catalogs, styles, and assets render in scoped document order |
| 5. Browser/a11y evidence | Stages 2-4 behavior present | No new required public API | Playwright plus manual AT evidence template | Candidate-facing behavior has keyboard, focus, live region, target-size, and manual AT signoff evidence |
| 6. Published conformance and final checklist | Local public gates pass | Published packages only | Private conformance in `../pie-qti-conformance` | Final qti3 feature checklist marks parity, intentional divergence, private status, and residual risk |

## Feature Matrix

| Feature area | Producer and consumer boundary | Public API touched | Required public evidence | Private conformance follow-up | Current status |
| --- | --- | --- | --- | --- | --- |
| Resolved per-item delivery context | `ims-cp-core` parses XML, `ims-cp-browser` resolves package-relative assets, `assessment-player` composes item context, `item-player` consumes already-resolved inputs | Additive item-player config for resolved stimulus/catalog/style inputs; assessment secure item context | Unit tests for resolution order, section/testPart/item-ref inheritance, package-relative bases, and compatibility with `catalogXml` | Verify official packages render item plus shared delivery context from published artifacts | First code pass |
| PNP/access-for-all display and content supports | `item-player` parses and applies PNP; host handles platform supports emitted by user action | Additive `PnpProfile` fields and `Player.updatePnp()` behavior | Parser/apply tests for canonical aliases, display/text preferences, magnification, host-routed supports, host-defined catalog usages, optional language preference, reserved-usage filtering, documented `html` event payloads, and dynamic rebinding cleanup | Verify expanded PNP support behavior without leaking vendor fixture names | First code pass; review findings fixed; focused tests pass |
| Effective time limits and itemSessionControl precedence | `assessment-player` resolves effective controls; backend adapter validates final timing decisions | Additive optional backend API timing state, expiry scope, and effective item control snapshots | Unit/integration tests for assessment/testPart/section/item-ref precedence, restore, expiry, late submission, and extended time | Verify published backend adapter contract honors official timing cases | Planned |
| Backend-authoritative timing enforcement | `assessment-player` sends timing evidence; backend adapter accepts, rejects, or finalizes | Additive optional `BackendAdapter`, submit/finalize request, and session timing fields with defaults for existing adapters | Adapter contract tests for server-side accept/reject/finalize decisions and persisted elapsed time | Verify private conformance runs against published package behavior, not local state | Planned |
| Shared stimulus runtime delivery | `ims-cp-core` extracts stimulus metadata, `ims-cp-browser` resolves resources, `assessment-player` passes resolved context, `item-player` renders | Additive resolved stimulus body/style/catalog inputs | Parser and renderer tests for multiple stimuli, docking order, undocked content, validation messages, explicit compatibility overrides, class merging, scoped catalog lookup, stylesheet scoping, browser rendering, and asset resolution | Verify shared stimulus delivery with published packages | Passed private delivery workflow against published `0.1.7` packages |
| Stylesheet and asset scoping | `ims-cp-browser` resolves and classifies URLs, `item-player` enforces render policy | Additive security policy configuration for package styles/assets | Tests for package-relative styles, blocked remote/unsafe URLs, path traversal, CSS escaping, instance-isolated scoping, stimulus-local scoping, and scoped stylesheet application | Verify official stylesheets do not require unsafe public defaults | Passed private delivery workflow against published `0.1.7` packages |
| Scoped catalog delivery | `ims-cp-core` extracts catalog XML, `item-player` scopes and resolves catalog entries | Additive rich catalog source model and host catalog event detail | Tests for item-local precedence, shared stimulus catalog fallback, language fallback, duplicate ID scoping, inactive PNP gating, sanitized host event content, unsafe usage-name rejection, and unsafe relative `qti-file-href` removal | Verify official catalog/glossary cases with published packages | Passed private delivery workflow against published `0.1.7` packages |
| Browser-visible PNP/catalog UI | `item-player` emits accessible UI/events, `apps/demo` exercises candidate-facing behavior | Component events and accessible names | Playwright tests for keyboard operation, Escape/focus return, distinct labels, dynamic PNP toggles, host events, no answer-key/source leakage, and target size | Manual AT checklist in `docs/certification/qti3-stage5-manual-a11y-checklist.md` | Public browser evidence complete; manual AT execution pending |
| Accessible timer UI | `assessment-player` emits warning/expiry state, `apps/demo` renders accessible status | Time warning/expiry events and shell rendering | Browser tests for localized warnings, live regions, no involuntary focus movement, disabled/late state, reduced motion, zoom/reflow, and contrast | Verify no timing conformance behavior depends on inaccessible UI-only state | Public browser evidence covers live warning/expiry regions, focus preservation, and narrow viewport reachability; reduced-motion/contrast manual evidence pending |
| Final qti3 package parity checklist | docs/certification | No runtime API | Checklist comparing each `qti3-*` package feature area to public evidence, intentional divergences, private status, and residual risk | Completed only after private conformance against published versions | Completed except manual AT signoff; see `docs/certification/qti3-final-gap-checklist.md` |

## Candidate Answer-Leakage Evidence

Every candidate-facing browser or DOM test added for this plan must assert that
answer keys are not exposed through:

- Visible text, hidden `sr-only` text, ARIA labels, descriptions, roles, or
  live-region announcements.
- Data attributes, custom event payloads, debug state, serialized item-session
  state, or catalog host-event detail.
- `correctResponse`, scoring metadata, solution feedback, or reviewer-only
  content when the active role is `candidate`.

## Public Coverage Rows To Update By Stage

- `qti30-advanced-a13-a15`: unit coverage now includes broader PNP,
  host-defined catalog usages, dynamic rebinding cleanup, user-initiated host
  events, sanitized event content, and unsafe usage-name rejection. Browser-visible
  catalog affordances and manual AT evidence remain Stage 5.
- `qti30-advanced-i4`: expand for resolved shared stimulus delivery,
  stylesheet/catalog scoping, and runtime renderer consumption. Unit coverage now
  includes package-relative stylesheet/stimulus path gates and unsafe relative
  asset/catalog file-reference removal, plus item-runtime stimulus insertion,
  explicit override precedence, class merging, undocked stimulus ordering, and
  instance-isolated and stimulus-local runtime stylesheet CSS, plus scoped catalog
  lookup for item/stimulus ID collisions. Browser-visible evidence now covers
  stimulus rendering, keyboard glossary popup behavior, PNP rebinding, host
  catalog events, CSS source-path leakage, and automated WCAG AA scanning.
- `qti30-advanced-t5`: expand for effective itemSessionControl precedence
  across testPart, section, and item-ref scopes.
- `qti30-advanced-t12`: expand for item/section/test time-limit precedence,
  restoration, expiry, and accessible browser-visible timer behavior.

## Manual Accessibility Evidence

Automated browser coverage can verify roles, names, focus order, live regions,
keyboard operation, target size, and accessibility snapshots. Before release,
the candidate-facing changes also need manual signoff with:

- NVDA with Chrome.
- VoiceOver with Safari.
- Keyboard-only navigation at 100%, 200% zoom, and text-spacing override.
- High-contrast or forced-colors mode where available.

Manual signoff records must include feature area, build/package version,
reviewer, date, browser and assistive technology versions, pass/fail result,
linked issue for any failure, and relevant WCAG 2.2 AA success criteria.
