# PRD: Accessibility System

<!--
  Status: current
  Type: system
  Packages: @pie-qti/item-player, @pie-qti/assessment-player, @pie-qti/default-components
  Last reviewed: 2026-04-28
-->

**Status:** current
**Type:** system
**Packages:** `@pie-qti/item-player`, `@pie-qti/assessment-player`, `@pie-qti/default-components`
**Last reviewed:** 2026-05-04

---

## Summary

The accessibility system is a cross-cutting set of patterns, components, and conventions that together satisfy WCAG 2.2 Level AA for K-12 standardized assessments delivered by the PIE-QTI framework. It covers screen reader announcement of dynamic state changes (`AccessibilityAnnouncer`), focus management across item navigation, ARIA attribute patterns inside Shadow DOM, visually-hidden text for assistive technology, keyboard navigation across every interaction type, minimum touch-target sizing, high-contrast theme support, and the implemented QTI 3.0 Personal Needs and Preferences (PNP) subset. Structured-label and braille support remain deferred under G-13.

---

## Background and rationale

### Legal requirement — Section 508 and K-12 procurement

US federal and state education contracts are subject to Section 508 of the Rehabilitation Act (Revised 2018), which adopts WCAG 2.1 Level AA by reference. WCAG 2.2 is a strict superset; satisfying 2.2 AA satisfies Section 508. K-12 assessment programs (state summative assessments, interim assessments, diagnostic tools) are legally required to provide accessible formats for students with disabilities under IDEA and Section 504. A player that cannot be used with a screen reader or a keyboard is not procurable by most US state or district customers regardless of content quality. WCAG 2.2 AA is therefore a hard gate on production deployments, not an enhancement.

### Shadow DOM ARIA boundary

All interaction components compile to Svelte custom elements backed by Shadow DOM. The ARIA `aria-labelledby` and `aria-describedby` attributes reference element IDs; IDs can only be resolved within the same document root. Because each custom element's shadow root is a separate document root, an element inside a shadow root cannot be labelled by an element in the host document, and vice versa. This is a fundamental Web Components constraint that cannot be worked around without polyfills or the experimental ARIA IDRef Reflection API (not yet stable across browsers as of 2026).

The consequence: every interaction component must be fully self-contained for labelling. It cannot delegate its accessible name to a `<label>` element in the host page or the item body renderer. Each component either derives its accessible name from its own internal markup or accepts an explicit label as a prop-driven ARIA attribute.

### Assessment-specific accessibility constraints

Assessments impose constraints beyond those of general web content:

1. **Timed environments.** A screen reader user who receives a flood of live-region announcements mid-test loses their place in the item body. The live region priority must be `polite` for routine state changes and reserved for `assertive` only for genuinely urgent interruptions (time expiry). The `clearAfter` parameter on `AccessibilityAnnouncer.announce()` prevents stale announcements from being re-read if the user switches focus.

2. **High-stakes context.** Interaction errors (e.g., malformed response, focus loss) must not leave the interface in a state the candidate cannot recover from without understanding the error. Accessible error messages must appear before submission is re-attempted, not after.

3. **Answer visibility control.** Correct answers are visible only in the `scorer` role. ARIA labels that expose correct-answer state (`aria-label="... Correct answer: ..."`) must be gated on the same `role === 'scorer'` condition used by the visual state. Leaking answer data through ARIA in `candidate` role is a test-security violation.

4. **Progress orientation.** Students — especially those with cognitive disabilities — need continuous context about where they are in the assessment. The "Question N of M" pattern in the navigation bar and the `aria-live="polite"` region on the content area serve this need without requiring the student to request orientation on every item change.

### Math accessibility

KaTeX is configured with `throwOnError: false` and is set to produce MathML output with ARIA annotations. The `aria-label` on the root `<math>` element carries the LaTeX source string, which is readable by screen readers that do not have native MathML support. QTI 2.2 items may contain native MathML markup; the typesetting pipeline converts QTI MathML to LaTeX before handing it to KaTeX so that the same rendering and ARIA path is used regardless of input format.

---

## Functional requirements

- **FR-1:** The framework must provide an ARIA live region component (`AccessibilityAnnouncer`) that can be used by any player component to announce dynamic state changes to screen readers without moving focus.
- **FR-2:** `AccessibilityAnnouncer` must support `polite` (default) and `assertive` priority levels. `polite` must be used for routine state changes (session restored, item loaded). `assertive` must be reserved for time expiry and submission failure.
- **FR-3:** When the assessment player navigates to a new item, it must programmatically move focus to the item content region so screen reader users are oriented to the new content without needing to manually navigate to it.
- **FR-4:** Every interaction component must carry sufficient ARIA attributes to communicate its role, current state, and accessible name to screen readers without relying on elements outside its shadow root.
- **FR-5:** The `NavigationBar` must provide Previous, Next, and Submit buttons that are keyboard-operable with no additional configuration by the host.
- **FR-6:** The navigation progress indicator ("Question N of M") must be accessible as both a visible text label and an ARIA-accessible region.
- **FR-7:** The `AssessmentTimer` must use `role="timer"` with `aria-live="polite"` and `aria-atomic="true"`, must expose the visible time through an accessible name, must announce the configured warning threshold politely, and must announce time expiry assertively. Multi-threshold warning schedules are a future enhancement unless the host supplies separate timer policy.
- **FR-8:** All ARIA label text that varies by locale must be sourced from the `@pie-qti/i18n` system. Hardcoded English strings are acceptable only as `??` fallbacks; they may not be the sole source of an ARIA label.
- **FR-9:** Visually-hidden but screen-reader-visible text must use the project `.sr-only` pattern. Shared packages may define a local copy only when they cannot safely import `packages/default-components/src/shared/styles/shared.css`.
- **FR-10:** WCAG 2.2 AA requires pointer targets of at least 24×24 CSS pixels for SC 2.5.8. This project additionally aims for 44×44 CSS pixels for learner-facing assessment controls where layout and item geometry make that reasonably possible.
- **FR-11:** Color must not be the sole visual differentiator for any state (selected, correct, incorrect, disabled). A non-color cue (icon, label, border pattern, shape) must accompany any color-based state indication.
- **FR-12:** The `choiceInteraction` component must expose the correct-answer badge and ARIA annotation only when `role === 'scorer'`.
- **FR-13:** Each drag-and-order interaction (`SortableList`, `OrderInteraction`) must provide a keyboard alternative using Space/Enter to grab an item and arrow keys to move it, with `aria-grabbed` state communicated to screen readers.
- **FR-14:** Hotspot interactions must expose each selectable region as a `role="button"` with `aria-pressed` toggling on selection and keyboard activation via Enter and Space.
- **FR-15:** Slider interactions must map to `<input type="range">` with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` attributes kept in sync with the current response value.
- **FR-16:** The assessment shell must include a single `AccessibilityAnnouncer` instance mounted at the root. Individual components must not mount their own announcers; they must receive an `announcer` reference from the shell or fire a custom DOM event that the shell's announcer handles.

---

## Non-functional requirements

- **Accessibility:** WCAG 2.2 Level AA across all interaction types, navigation, timer, and feedback components. Screen reader support must be verified against NVDA+Chrome and VoiceOver+Safari as the minimum matrix. Keyboard navigation must be fully operable with no mouse dependency.
- **Performance:** The `AccessibilityAnnouncer` DOM node must always be present in the document (not conditionally rendered) to avoid the common screen reader bug where a late-mounted live region is not announced. The `clearAfter` timeout (default 1000 ms) must be long enough for slow screen readers to complete the announcement; reducing it below 800 ms is not recommended.
- **Cross-platform:** Touch targets must meet WCAG 2.2 AA's 24×24 px requirement and should meet the project's 44×44 px learner-friendly target on a 375px-wide viewport where feasible. Focus rings must be visible on both light and high-contrast themes; the default DaisyUI `focus-visible` outline must not be overridden without providing an equivalent.
- **Security:** ARIA labels that expose correct-answer data must be gated behind `role === 'scorer'` at the component level, not at the host level. The component must not trust the host to suppress this; it must suppress it internally.
- **i18n:** All ARIA-facing strings must be declared in the `accessibility.*` namespace of the `@pie-qti/i18n` locale files. See the i18n PRD (`docs/prds/systems/i18n.md`) for the key naming convention. Interaction-specific ARIA strings (e.g., "Reorderable list of choices") belong in the `interactions.*` namespace.

---

## Design decisions

### AccessibilityAnnouncer as a singleton per player shell

**Decision:** A single `AccessibilityAnnouncer` is mounted at the `AssessmentShell` root. Interaction components and child components do not mount their own.

**Rationale:** Multiple concurrent live regions cause screen readers to queue announcements unpredictably or drop them entirely. Centralizing all announcements in one region gives the player precise control over announcement priority and ordering. The `polite` live region is sufficient for the majority of cases; `assertive` is reserved for critical interruptions. A component needing to announce something fires a custom event (`qti-announce`) that the shell's announcer handles, keeping components decoupled from the announcer's DOM location.

**Alternatives considered:** Per-component live regions (one per interaction type) — rejected because concurrent announcements from multiple live regions interfere with each other across screen reader implementations. In-band DOM updates with `aria-live` on the content container — rejected because the content area uses `aria-live="polite"` already (for item navigation); mixing announcement text into it creates garbled output.

**Consequences:** Components cannot announce without a reference to the shell's announcer or a custom event pathway. This must be part of the component-to-shell contract. Components tested in isolation (e.g., in unit tests or Storybook) must either receive a mock announcer or skip announcement logic.

---

### Shadow DOM ARIA self-containment

**Decision:** Each interaction component in `@pie-qti/default-components` is responsible for its own complete ARIA labelling. No component relies on `aria-labelledby` or `aria-describedby` referencing elements outside its shadow root.

**Rationale:** See Background: IDREFs cannot cross shadow boundaries in current browser implementations. Cross-boundary ARIA is specified in ARIA 1.3 IDREF reflection but is not reliably supported as of 2026.

**Alternatives considered:** Using the ARIA IDRef Reflection API (`Element.ariaLabelledByElements`) to cross shadow boundaries — rejected because Safari and Firefox support is incomplete. Extracting interaction components from Shadow DOM (remove the `customElement` compilation option) — rejected because Shadow DOM style isolation is load-bearing for multi-host deployments where the host's CSS must not affect interaction rendering.

**Consequences:** Every interaction component must accept or generate its accessible name internally. When an item body contains a prompt (`<p>Select the correct answer:</p>`) intended to label a downstream interaction, the interaction cannot reference that element. The host or item renderer must either pass the prompt text as an explicit prop or duplicate it as a visually-hidden `sr-only` span inside the component. This is a known UX gap: in practice, QTI items typically include sufficient labelling cues within or adjacent to the interaction markup itself.

---

### `role="polite"` as default for AccessibilityAnnouncer

**Decision:** `AccessibilityAnnouncer` defaults to `aria-live="polite"`.

**Rationale:** In a timed assessment, `assertive` interrupts the user's current screen reader reading position immediately — including while they are reading item text. An `assertive` announcement at the wrong moment can cause the student to lose their reading context entirely. Only the time-expiry and critical-error cases justify this interruption. All other state changes (item loaded, response saved, session restored) use `polite` so the announcement queues after the user's current reading position.

**Alternatives considered:** Always using `assertive` for reliability — rejected because reliability at the cost of reading disruption fails the assessment UX requirement. Always using `polite` and never providing `assertive` — rejected because genuine time-critical information (exam time has expired) must reach the user immediately.

**Consequences:** `polite` announcements can be missed if the user is actively reading and the `clearAfter` timeout elapses before the screen reader reaches the live region. The 1000 ms default `clearAfter` is a balance; callers that need guaranteed delivery (e.g., session-restored confirmation) should pass a longer `clearAfter` value.

---

### Color-plus-non-color state indication

**Decision:** Every state that uses color also carries a non-color cue: the correct-answer badge adds a text label ("Correct"), disabled inputs carry `disabled` attribute and reduced opacity, selected hotspots add `aria-pressed="true"` and a visible border.

**Rationale:** WCAG 1.4.1 (Use of Color) requires that information conveyed by color alone is also conveyed by another means. K-12 assessments are used by students with color-vision deficiency; the percentage in the school-age population is approximately 8% of males. Relying on green/red coloring to convey correct/incorrect in the scorer view fails this population.

**Alternatives considered:** Using pattern fills or hatching on incorrect answers — rejected as visually noisy and inconsistent with the DaisyUI design language. Using icons only — acceptable but used in addition to text labels, not instead of, because icon-only indicators fail users who do not recognize the iconography.

**Consequences:** Any future interaction component added to `@pie-qti/default-components` must follow this rule. Code review must reject components that add a color-based state without a paired non-color indicator.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|---------------|------------|---------|
| Announcement API | `AccessibilityAnnouncer` (exported from `@pie-qti/assessment-player`) | Call `announcer.announce(message, clearAfter?)` from shell-level code; pass announcer ref to child components that need it | Announce "Session restored from previous attempt" on state-restore |
| Announcement priority | `priority?: 'polite' \| 'assertive'` prop and per-message priority on `AccessibilityAnnouncer.announce()` | Use polite for routine orientation and assertive for time-critical errors or expiry | `announcer.announce(message, 3000, 'assertive')` |
| Custom ARIA label for interaction | `aria-label` or `aria-labelledby` prop accepted by some components | Pass a descriptive label derived from surrounding item content | Pass the question stem text as the choiceInteraction's group label |
| `sr-only` utility | `.sr-only` class in `shared.css` | Import `shared.css` in any component that needs visually-hidden accessible text | Add a screen-reader-only hint explaining how to use a custom interaction |
| High-contrast theme | DaisyUI `data-theme="high-contrast"` on the root element | Set the attribute on the `<html>` or player shell element based on PNP or OS preference | Host reads `prefers-contrast: more` media query and applies the theme |
| Focus management hook | `manageFocusAfterNavigation()` in `AssessmentShell.svelte` | Override by mounting a custom shell that implements its own focus strategy | Direct focus to a specific landmark or heading rather than the content region |

---

## Acceptance criteria

### Functional

**AC-1: Announcer is always present in DOM**
```
Given: The AssessmentShell is mounted
When: The DOM is inspected before any navigation occurs
Then: Exactly one element with role="status" and aria-live="polite" exists in the document
  and it is visually hidden (has the sr-only class or equivalent)
  and it is not inside a Shadow DOM boundary
```

**AC-2: Session-restore announcement**
```
Given: An assessment with a previously-saved session state
When: The player restores that state on load
Then: The accessibility announcer emits a message such as "Session restored from previous attempt"
  and the message is cleared after the configured clearAfter interval
  and no announcement fires if there is no prior state to restore
```

**AC-3: Correct-answer ARIA gated on scorer role**
```
Given: A choiceInteraction with correctResponse set
  and role is "candidate"
When: A screen reader reads the choice inputs
Then: No choice's accessible name includes the word "Correct" or references the correct answer
```

**AC-4: Correct-answer ARIA visible in scorer role**
```
Given: A choiceInteraction with correctResponse set
  and role is "scorer"
When: A screen reader reads the choice inputs
Then: The choice matching the correct response has an accessible name that includes "Correct"
  and a visible badge reading "Correct" appears next to that choice
```

**AC-5: Timer announces expiry assertively**
```
Given: An assessment with a time limit
When: The configured warning threshold is reached
Then: The AssessmentTimer exposes a polite warning announcement
When: The time limit reaches zero
Then: The expiry message is announced assertively
  and the AssessmentTimer component carries role="timer" and aria-live="polite"
```

**AC-6: Navigation bar buttons are keyboard-operable**
```
Given: The NavigationBar is rendered with canPrevious=true and canNext=true
When: A keyboard user tabs to the Previous button and presses Enter
Then: The previous item loads
  and focus is moved to the item content region after the transition
```

**AC-7: NavigationBar buttons disabled state is accessible**
```
Given: The NavigationBar is rendered on the first item (canPrevious=false)
When: A screen reader inspects the Previous button
Then: The button is announced as disabled (disabled attribute is set)
  and the button is not interactive (keyboard activation does nothing)
```

---

### Keyboard navigation

**AC-K1: Choice interaction — radio group keyboard navigation**
```
Given: A choiceInteraction with maxChoices=1 (radio buttons) is rendered
  and the interaction is not disabled
When: A keyboard user tabs to the first radio button, then presses the Down arrow key
Then: Focus moves to the next radio option
  and pressing Space selects the focused option
  and the response value updates accordingly
```

**AC-K2: Choice interaction — checkbox keyboard navigation**
```
Given: A choiceInteraction with maxChoices > 1 (checkboxes) is rendered
When: A keyboard user tabs to a checkbox and presses Space
Then: The checkbox is toggled
  and the response array is updated to include or exclude the choice identifier
```

**AC-K3: Order interaction — keyboard grab and move**
```
Given: An orderInteraction is rendered with at least two choices
When: A keyboard user tabs to a list item and presses Space (or Enter)
Then: The item is grabbed (aria-grabbed="true" is set on the item)
  and pressing the Down arrow key moves the item one position down
  and pressing Space (or Enter) again drops the item at the new position
  and the aria-live region announces the new position
```

**AC-K4: Hotspot interaction — keyboard selection**
```
Given: A hotspotInteraction is rendered with at least one hotspot region
When: A keyboard user tabs to a hotspot region and presses Enter or Space
Then: The region is selected
  and aria-pressed changes from "false" to "true"
  and subsequent Enter/Space toggles the selection
```

**AC-K5: Slider interaction — arrow key increment**
```
Given: A sliderInteraction is rendered
When: A keyboard user focuses the slider and presses the Right arrow key
Then: The slider value increments by one step
  and aria-valuenow reflects the new value
  and pressing the Left arrow key decrements by one step
```

**AC-K6: No keyboard trap**
```
Given: Any interaction component rendered in the assessment shell
When: A keyboard user tabs through all focusable elements within the component
Then: Focus exits the component and moves to the next focusable element in the page
  and the user can reach the NavigationBar buttons without using the mouse
```

---

### Screen reader

**AC-SR1: Live region announces item transitions**
```
Given: An assessment with multiple items
When: The user activates the Next button
Then: The content area (role="region" with aria-live="polite") updates
  and a screen reader announces the new item content on focus arrival
  and the AccessibilityAnnouncer does not fire a competing announcement for routine navigation
```

**AC-SR2: Progress is readable without navigation**
```
Given: The NavigationBar is visible with showProgress=true
When: A screen reader reads the progress label
Then: The label text matches the pattern "Question N of M" (or the localized equivalent)
  and the <progress> element has a computed accessible value corresponding to the percentage
```

**AC-SR3: SortableList provides instructions for keyboard users**
```
Given: An orderInteraction backed by SortableList is rendered
When: A screen reader encounters the list
Then: The list has an aria-describedby reference pointing to the sr-only instructions element
  and the instructions explain how to grab (Space/Enter) and move (arrow keys) items
```

**AC-SR4: Slider accessible name includes range bounds**
```
Given: A sliderInteraction with lowerBound=0 and upperBound=10 is rendered
When: A screen reader focuses the slider input
Then: The accessible name includes the lower and upper bounds
  and aria-valuemin and aria-valuemax reflect those bounds
  and aria-valuenow reflects the current response value
```

**AC-SR5: Hotspot region accessible name does not rely on visual position alone**
```
Given: A hotspotInteraction is rendered
When: A screen reader reads a hotspot region element
Then: The element has an aria-label that includes the choice identifier
  and the accessible name is not "image" or an empty string
```

**AC-SR6: Math content is announced with LaTeX source**
```
Given: An item containing a MathML or LaTeX expression rendered via KaTeX
When: A screen reader encounters the rendered math element
Then: The <math> or root element has an aria-label containing the LaTeX source string
  and the screen reader does not read internal KaTeX markup spans
```

**AC-SR7: Inline choice prompt is announced as a combobox**
```
Given: An inlineChoiceInteraction is rendered within running text
When: A screen reader focuses the interaction
Then: The element is announced as a combobox or select control
  and the accessible name identifies the response slot
```

---

### Touch

**AC-T1: Navigation buttons meet minimum touch target**
```
Given: The NavigationBar is rendered on a 375px viewport
When: The bounding rect of the Previous and Next (or Submit) buttons is measured
Then: Each button's width and height meet WCAG 2.2 AA target size
  and should be at least 44px where the layout allows
```

**AC-T2: Choice options meet minimum touch target**
```
Given: A choiceInteraction is rendered
When: The bounding rect of each choice label (the entire tappable row) is measured
Then: Each option's height meets WCAG 2.2 AA target size
  and should be at least 44px where the interaction design allows
```

**AC-T3: Hotspot regions meet minimum touch target on mobile**
```
Given: A hotspotInteraction is rendered
When: A hotspot region's bounding rect is measured on a 375px viewport
Then: The tappable area meets WCAG 2.2 AA target size
  Notes: If the SVG/image hotspot region is smaller than the learner-friendly 44px target, an invisible touch-target overlay should expand it where that does not change item meaning
```

---

### Edge cases

**AC-E1: Disabled interaction is not keyboard-operable**
```
Given: An interaction component rendered with disabled=true
When: A keyboard user attempts to tab to interactive elements within the component
Then: No focusable elements within the component are reachable via Tab
  and tabindex=-1 is applied to all interactive elements when disabled=true
```

**AC-E2: Announcement queue does not overflow on rapid navigation**
```
Given: An assessment where the user rapidly navigates through items using keyboard shortcuts
When: Next is activated five times in quick succession
Then: Only the most recent pending announcement is queued; earlier stale announcements are cancelled
  and the announcer's clearTimeout is called before each new announcement is set
```

**AC-E3: High-contrast theme does not hide focus rings**
```
Given: The assessment shell is rendered with data-theme="high-contrast"
When: A keyboard user tabs through interactive elements
Then: The focus ring is visible on every focused element
  and no CSS rule in the theme overrides focus-visible outline to "none" without replacement
```

**AC-E4: Missing i18n provider — ARIA attributes do not become empty strings**
```
Given: An interaction component is rendered with no i18n prop
When: The rendered DOM is inspected for aria-label and aria-describedby attributes
Then: No attribute contains an empty string
  and all ARIA labels fall back to their hardcoded English string via the ?? operator
```

**AC-E5: Timer expiry does not move focus involuntarily**
```
Given: An assessment with a time limit
  and a keyboard user has focused an interactive element within the item body
When: The time limit expires
Then: Focus is not moved away from the candidate's current position
  and the expiry is communicated via the assertive announcer only
  and the interaction is disabled (disabled=true) without a focus change
```

---

## Open questions

- [x] **G-09 — PNP profile:** Shipped in commit `fa8fa97` (2026-04-28). Color schemes, elimination tool, extended time, glossary/keyword-translation triggers and popups are all implemented. See `docs/prds/systems/pnp.md` for full specification.

- [ ] **G-13 — Structured label and braille support (Tier 3, Deferred):** PNP `structuredLabelSupport` adds supplementary ARIA group wrappers and sub-labels to complex interactions. `braille-text` catalog entries expose content to refreshable braille displays. The catalog prerequisite (G-10) has shipped; G-13 itself remains deferred. See `docs/SPEC-GAPS-PLAN.md` §G-13.

- [ ] **Cross-shadow ARIA with ARIA IDRef Reflection:** ARIA 1.3 defines `ariaLabelledByElements` / `ariaDescribedByElements` to allow IDREF relationships across shadow boundaries. As of 2026 this is not reliably supported in all target browsers. Once browser support stabilizes, interaction components should be updated to accept external labelling rather than requiring self-contained labels.

- [ ] **Drag interactions keyboard coverage audit:** `SortableList` (used by `orderInteraction`) has a keyboard alternative. It is not confirmed that all other drag-based interactions (`graphicGapMatchInteraction`, `graphicAssociateInteraction`, `positionObjectInteraction`) have keyboard alternatives meeting WCAG 2.1 SC 2.1.1. Each must be audited; gaps must be tracked as individual items.

- [ ] **Timer announcement thresholds are hard-coded:** The 5-minute, 1-minute, and 30-second thresholds are documented intent but their implementation in `AssessmentTimer.svelte` / `TimeManager.ts` should be verified. If not present, they must be added. Whether these thresholds should be configurable via `PlayerConfig` has not been decided.

- [ ] **Screen reader test matrix:** The required screen reader / browser pairs for QA sign-off are NVDA+Chrome and VoiceOver+Safari (macOS). There is no current automated test coverage for screen reader behavior; all AC-SR criteria require manual verification. The feasibility of axe-core or similar automated checks for a subset of criteria should be evaluated.

---

## Related

- Implementation: `packages/assessment-player/src/components/AccessibilityAnnouncer.svelte`
- Implementation: `packages/assessment-player/src/components/AssessmentShell.svelte` (focus management, announcer mount)
- Implementation: `packages/assessment-player/src/components/NavigationBar.svelte`
- Implementation: `packages/assessment-player/src/components/AssessmentTimer.svelte`
- Implementation: `packages/default-components/src/shared/styles/shared.css` (`.sr-only`)
- Implementation: `packages/default-components/src/shared/components/SortableList.svelte` (keyboard drag pattern)
- Implementation: `packages/default-components/src/plugins/hotspot/HotspotInteraction.svelte` (aria-pressed pattern)
- Implementation: `packages/default-components/src/plugins/slider/SliderInteraction.svelte` (range ARIA)
- Spec gaps: `docs/SPEC-GAPS-PLAN.md` — G-09 (PNP profile), G-13 (structured label / braille)
- Adjacent PRDs: `docs/prds/systems/i18n.md` (ARIA label localization requirements)
- Adjacent PRDs: `docs/prds/systems/theming.md` (high-contrast theme, CSS custom properties)
- Standards: WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- Standards: Section 508 Revised (2018) — https://www.access-board.gov/ict/
- Standards: QTI 3.0 PNP spec — §6.2 of the QTI 3.0 delivery service spec
