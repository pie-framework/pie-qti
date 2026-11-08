# Accessibility testing

How the player's accessibility (WCAG 2.2 Level AA) is verified: which behaviors the
automated suites guard on every change, and which still need a person with a screen
reader. Requirements and rationale live in the
[accessibility PRD](../prds/systems/accessibility.md); this page is about evidence.

## Layers

| Layer | Where | Runs | What it is good at |
| ----- | ----- | ---- | ------------------ |
| Component tests (Vitest + jsdom) | `packages/default-components/tests/component/*.vitest.ts` | `bun run test:component` in `packages/default-components` | ARIA attributes, names wired through `aria-labelledby`, keyboard handlers, the `qti-change` contract, disabled states — fast, per component |
| axe scans (Playwright + axe-core) | `apps/demo/tests/playwright/component-fixtures-a11y.pw.ts`, `qti3-stage5-a11y.pw.ts` | `bun run test:a11y` (Chromium) | Static WCAG rule violations in the rendered DOM, in its initial state |
| Behavior regressions axe cannot see | `apps/demo/tests/playwright/a11y-regression.pw.ts` (fixture: `/fixtures/a11y-regression?item=…`) | `bun run test:a11y` (Chromium) and `bun run test:e2e:cross-browser` (WebKit, Firefox) | Computed names, state-dependent contrast, keyboard focus, dialog mechanics |
| Cross-browser smoke | `apps/demo/tests/playwright/cross-browser-smoke.pw.ts` | `bun run test:e2e:cross-browser` | Item rendering order, assessment navigation/submit, scored interaction evals on WebKit and Firefox |

Run everything from `apps/demo` after `bun run build` at the root. Locally, pin the port so
you never collide with a running dev server: `PLAYWRIGHT_PORT=5214 bun run test:a11y`.

### Cross-browser projects

`apps/demo/playwright.config.ts` defines `chromium` (the whole suite), `webkit` and
`firefox`. The last two run only tests tagged `@cross-browser`. Install their engines once
with `bunx playwright install webkit firefox` (from `apps/demo`), then
`bun run test:e2e:cross-browser`. `bun run test:e2e` stays Chromium-only.

Safari on macOS skips buttons, radios and checkboxes on Tab unless "Press Tab to highlight
each item" is enabled (off by default); Option+Tab moves through every control. The
regression tests use Option+Tab for WebKit on macOS and Tab everywhere else, including
WebKit on Linux in CI.

In CI, the **Accessibility Verification** job installs all three engines, runs
`verify:a11y` on Chromium, then the `@cross-browser` subset on WebKit and Firefox. The
subset is 46 tests (about 40 seconds on one worker), so it rides along in that job instead of
paying for a separate checkout, install and build; the engine downloads make it roughly 2–3
extra minutes, and the job still finishes inside the full Chromium end-to-end job.

## Covered automatically

| Behavior | WCAG | Test | Engines |
| -------- | ---- | ---- | ------- |
| No QTI identifier in any accessible name, description or naming attribute: choice, inline text entry and inline choice, gap match, order, match, associate, hotspot, graphic order (fixture identifiers are answer-revealing, e.g. `CHOICE_A_MARS_IS_THE_PLANET_CORRECT`) | 1.3.1, 4.1.2 | `a11y-regression.pw.ts` › no QTI identifiers in accessible names | all three |
| Names and announcements recomputed from state stay identifier-free after the candidate answers every interaction: filled-blank names, pair-remove buttons, move buttons, live-region messages ("Placed the Seine in blank 1 of 2.", "Eiffel Tower matched with Paris.") | 1.3.1, 4.1.2, 4.1.3 | same | all three |
| Controls are named by their rendered content (choice text, hotspot and graphic-order labels, positional blank names, palette words) | 2.5.3, 4.1.2 | same | all three |
| Authored image alternatives reach the rendered image of hotspot, select point, graphic order, graphic associate, graphic gap match, position object and drawing, and the gapImg tiles | 1.1.1 | `a11y-regression.pw.ts` › graphic image alternatives | all three |
| An author-marked decorative image (`<img alt="">`) renders `alt=""`; a QTI 2.x `<object data="…">` fallback text becomes the rendered image's alt | 1.1.1 | same | all three |
| Image-only and MathML-only choices in order, match and associate get content-derived names, never "Item" | 1.1.1, 4.1.2 | `a11y-regression.pw.ts` › rich content choice names | all three |
| Selection-limit message and text-entry validation error keep 4.5:1 (measured from computed styles after triggering the state) | 1.4.3 | `a11y-regression.pw.ts` › state-dependent contrast | all three |
| Empty text-entry blanks and gap-match targets keep a 3:1 boundary | 1.4.11 | same | all three |
| Keyboard focus on an SVG hotspot region draws a ≥2px stroke at ≥3:1 against both colors it straddles | 2.4.7, 1.4.11 | `a11y-regression.pw.ts` › keyboard focus visibility | all three |
| Keyboard focus on a hidden-input choice draws a solid ≥2px outline on its row at ≥3:1 | 2.4.7, 1.4.11 | same | all three |
| Modal feedback is a real modal: focus moves in, Tab and Shift+Tab never reach the page behind, the page behind is inert, Escape closes, focus returns to Submit | 2.1.2, 2.4.3 | `a11y-regression.pw.ts` › modal semantics (all three); `item-rendering-order.pw.ts` (Chromium) | all three |
| The math-input dialog is a named, described modal: focus lands in the math field, Tab walks its controls and wraps, Escape cancels and returns focus to the toolbar button | 2.1.2, 2.4.3, 4.1.2 | `a11y-regression.pw.ts` › modal semantics; `math-dialog.vitest.ts` | all three (component test: jsdom) |
| Portable custom interaction (PCI) host: a named group, one loading status, load and engine failures announced as alerts, module responses published through `qti-change` (once, never doubled under a player-owned host), read-only state forwarded to the module on mount and on every change, scaffold sanitized | 4.1.2, 4.1.3 | `portable-custom.vitest.ts` | jsdom |
| customInteraction fallback: the unsupported-interaction explanation, a labelled manual-entry field reporting through `qti-change`, disabled state, authored group name and description | 3.3.2, 4.1.2 | `custom.vitest.ts` | jsdom |
| Static rule violations of every component fixture and the QTI 3 PNP/catalog/stimulus fixture | WCAG 2.2 AA axe rules | `component-fixtures-a11y.pw.ts`, `qti3-stage5-a11y.pw.ts` | Chromium |

### Known product bugs

There are no known-failing accessibility tests right now. The three failures this page used to
carry as reminders — the math-input dialog's dead Shift+Tab wrap, the customInteraction
fallback's duplicate textarea ids, and its untranslated fallback text — are all fixed, and
their tests run as active regressions (`a11y-regression.pw.ts`, `custom.vitest.ts`; the two
table rows above reference them).

When a change exposes a real product bug that should not block delivery, keep its test but
mark it: `test.fixme(...)` in Playwright, or `test.skip(...)` plus a `FIXME` comment in Vitest
(which has no `test.fixme`). The comment names the bug, the WCAG criterion and how it
reproduces. The change that fixes the bug removes the marker so the test becomes an active
"Regression: …" guard — exactly what happened to the three above.

## Still needs manual screen-reader testing

Automation proves that names, roles, states and focus are *in the DOM and accessibility
tree*. It cannot prove what a screen reader *says*, when, or how it feels to use. The
minimum manual matrix is NVDA + Chrome and VoiceOver + Safari (macOS); add JAWS + Chrome for
district procurement, and TalkBack + Chrome (Android) and VoiceOver + Safari (iOS) for touch.

Check by hand, per release or when the interaction changes:

- **Announcements**: wording, timing and politeness of live regions — drag-and-drop grab,
  move and drop messages, selection-limit alerts, validation errors, the loading status of a
  PCI, timer warnings. Automation checks that the region and text exist, not that they are
  spoken once, in order, without interrupting the item.
- **Math speech**: MathML and MathLive output. The computed accessible name of a fraction
  choice flattens to its digits ("3 4"); whether a screen reader speaks "three quarters"
  depends on its math support (NVDA with MathCAT, JAWS, VoiceOver differ).
- **Browse versus focus mode**: switching into custom widgets (SVG hotspot buttons, sortable
  lists, match tables, the gap-match palette) and back out, in NVDA and JAWS.
- **Touch exploration**: swipe order, double-tap activation and the non-drag alternatives for
  order, gap match and graphic interactions under TalkBack and iOS VoiceOver.
- **Image descriptions**: that the authored alternative and long description are read once
  and not doubled by the region or tile that wraps them.
- **Forced colors and high contrast**: Windows High Contrast / `forced-colors: active` keeps
  focus rings, selected states and region outlines visible.
- **Zoom and reflow** at 200% and 400% with a screen reader running (the suites check a
  phone viewport, not magnifier use).
- **Third-party PCI modules**: anything inside a portable custom interaction is the module's
  own markup; the host guarantees only the named group, status and error alerts around it.
- **Braille output** and refreshable-display behavior (deferred in the PRD).

Record findings against the WCAG criterion and the interaction, and turn any repeatable
failure into an automated test in the layer that can see it.
