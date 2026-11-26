# PRD: Math Typesetting System

<!--
  Status: current
  Type: system
  Packages: @pie-qti/typeset-katex, @pie-qti/item-player
  Last reviewed: 2026-11-26
-->

**Status:** current  
**Type:** system  
**Packages:** `@pie-qti/typeset-katex`, `@pie-qti/item-player`  
**Last reviewed:** 2026-11-26

---

## Summary

The PIE-QTI math typesetting system renders mathematical expressions inside assessment items without bundling a math engine into the player itself. `@pie-qti/item-player` exposes an optional `typeset?: (element: HTMLElement) => void` hook through its Svelte/web-component rendering surfaces; host applications wire this hook to whichever renderer they choose. `@pie-qti/typeset-katex` provides the recommended default implementation: a KaTeX-based function that scans the DOM for LaTeX delimiters, keeps authored MathML native (MathML Core) while normalizing it losslessly, lazy-loads KaTeX's auto-render module on demand, and protects `contenteditable` regions from DOM mutation. The hook is optional — items that contain no math impose zero KaTeX cost on the page.

---

## Background and rationale

### Why QTI assessments require math rendering

QTI item authors express mathematical notation in two ways:

1. **MathML** — the XML-native representation that QTI endorses (`<math>`, `<mfrac>`, `<msup>`, etc.). It is structurally precise and round-trips through authoring tools, but browser MathML rendering has historically been inconsistent, and KaTeX does not render MathML directly.
2. **LaTeX delimiters** — inline `\( … \)`, display `\[ … \]`, or `$$ … $$` strings embedded in item body prose or prompt text. Many QTI authoring tools emit LaTeX when exporting to HTML or when a content author writes math by hand.

A player that renders neither will display raw `\frac{x}{2}` strings and MathML element text alongside multiple-choice options — unacceptable for a K-12 test-taker.

### Why the player does not bundle a math engine

Two constraints made bundling the wrong choice:

1. **Bundle budget.** KaTeX's minified + gzipped footprint is approximately 100 KB. The item player is intended to be embedded in host apps that may themselves be large React or Angular applications. Forcing every host to pay the KaTeX cost — even hosts whose content catalog contains no math — is unreasonable. A host deploying only ELA (English Language Arts) reading passages has zero need for a math renderer.

2. **Renderer choice.** KaTeX is fast but supports a narrower LaTeX subset than MathJax. Some host apps have already standardized on MathJax. Others pre-render math server-side (the resulting HTML contains ready-to-display styled elements, not raw LaTeX) and need no client-side renderer at all. Hard-coding KaTeX would prevent all of these deployment patterns without providing any benefit to the host.

The `typeset` hook resolves both constraints: the player exposes a dependency injection point, and the host provides the implementation (or none at all).

### Why KaTeX over MathJax as the reference implementation

KaTeX renders synchronously and is an order of magnitude faster at initial render than MathJax. For a timed K-12 assessment where dozens of math-heavy items may be displayed in succession, render latency is a user experience concern. `@pie-qti/typeset-katex` therefore uses KaTeX as its implementation, while the hook interface remains renderer-neutral.

### Why authored MathML stays native

Modern browsers (Chrome 109+, Safari, Firefox) render MathML Core, and QTI-endorsed `<math>` markup is structurally precise, so converting it would lose information. `typesetMathInElement` therefore never converts MathML to LaTeX: authored MathML stays in the DOM and renders through the browser's MathML Core engine. Two lossless normalizations run instead: namespace-prefixed MathML (`<m:math>`, `<mfrac>`) is re-namespaced into unprefixed MathML so browsers' HTML parsers recognize it, and `<mfenced>` (removed in MathML Core) is expanded into the equivalent `mrow` + `mo` fence markup. KaTeX then handles only the LaTeX-delimiter text around the math, in one pass.

---

## Functional requirements

- **FR-1:** `@pie-qti/item-player` must expose `typeset?: (element: HTMLElement) => void` as an optional rendering-surface prop/configuration field. The player must not declare a dependency on any math rendering library.
- **FR-2:** When `typeset` is provided, the player must call it on the item body container element after the item HTML has been rendered into the DOM.
- **FR-3:** When `typeset` is provided, the player must call it again whenever item content re-renders due to a response change, state change, or `outcomeValues` update (e.g. feedback visibility toggling).
- **FR-4:** Calls to `typeset` must be scheduled with `requestAnimationFrame` so that the DOM is fully painted before the function runs; errors thrown by `typeset` must be caught and swallowed (raw text remains; no exception propagates).
- **FR-5:** `typesetMathInElement` in `@pie-qti/typeset-katex` must scan `innerHTML` for the presence of at least one math signal before loading KaTeX. If no signal is found, the function must return early without loading the KaTeX module.
- **FR-6:** The math signals checked in the pre-scan must include: `\(`, `\[`, `$$`, `\begin{`, `\frac`, `\sqrt`, plus `$` only when `enableSingleDollar: true` is passed. The presence of `<math` alone is not a signal: MathML is not KaTeX's input, so a MathML-only item must not trigger a KaTeX load.
- **FR-7:** `typesetMathInElement` must normalize namespace-prefixed MathML (`<m:math>`, `<mfrac>`, …) to unprefixed MathML before rendering, so browser MathML Core engines parse it.
- **FR-8:** `<mfenced>` (removed in MathML Core) must be expanded losslessly into the equivalent `mrow` + `mo` fence markup before rendering.
- **FR-9:** Authored MathML must never be converted to LaTeX, mutated beyond the two normalizations above, or double-rendered; double-render protection comes from `math` in the ignored-tag list, the `isProtected` check (`.katex` ancestors and `contenteditable` regions), and the `ignoredClasses` option.
- **FR-10:** `typesetMathInElement` must support the following KaTeX delimiter pairs: `\( … \)` (inline), `\[ … \]` (display), `$$ … $$` (display), and optionally `$ … $` (inline, off by default).
- **FR-11:** KaTeX's `auto-render` module must be loaded via a dynamic `import()` call, and the resulting `Promise` must be cached at module level so that subsequent calls to `typesetMathInElement` reuse the already-loaded module rather than issuing a new network request.
- **FR-12:** Elements with `contenteditable="true"` must receive the class `katex-ignore-editor` before KaTeX auto-render runs, and the class must be removed after rendering completes.
- **FR-13:** KaTeX must be configured with `throwOnError: false` so that malformed LaTeX renders as an error indicator rather than throwing a JavaScript exception that would abort rendering for the surrounding content.
- **FR-14:** KaTeX must skip the following tag types: `script`, `noscript`, `style`, `textarea`, `pre`, `code`, `option`, `math`. It must also skip any element with the classes `katex`, `katex-display`, or `katex-ignore-editor`.
- **FR-15:** `@pie-qti/typeset-katex` must export a `./css` entry point (`import '@pie-qti/typeset-katex/css'`) that imports KaTeX's compiled CSS. The host app must import this entry point at the document level; the player packages must not import it.

---

## Non-functional requirements

- **Accessibility:** KaTeX produces `<math>` MathML with `aria-label` attributes by default for its display output, providing accessible descriptions to screen readers. This behavior must not be suppressed. KaTeX's rendered math must not interfere with the tab order of interactive elements in the item body.
- **Performance:** KaTeX auto-render must not be loaded until the first item that contains math is rendered. Subsequent items on the same page reuse the cached module; no second network request is issued. The pre-scan (`containsLatexDelimiters`, module-private) is a string search on `innerHTML` and must complete in under 1 ms for typical item body sizes (< 50 KB).
- **Cross-platform:** KaTeX renders via HTML+CSS and does not depend on canvas or WebGL. It works on all modern browsers and on iOS Safari. Display math (`\[ … \]`) requires KaTeX CSS at the document level; the player does not attempt to inject this CSS.
- **Security:** `typesetMathInElement` reads and mutates the DOM of the item body element. It must not read or write outside the passed `root` element. The `katex-ignore-editor` guard prevents mutation of `contenteditable` regions that contain ProseMirror/TipTap internal state.
- **i18n:** Math notation is language-neutral. KaTeX renders LaTeX symbols regardless of locale. No i18n configuration is required for the typesetting system.

---

## Design decisions

### Opt-in `typeset` hook, not bundled renderer

**Decision:** `@pie-qti/item-player` does not depend on KaTeX or any other math library. It exposes `typeset?: (element: HTMLElement) => void` as an optional hook. `@pie-qti/typeset-katex` is a separate package that host apps opt into.

**Rationale:** Players that render only ELA or science items with no math would otherwise pay a ~100 KB gzipped KaTeX bundle cost unconditionally. Hosts that prefer MathJax (for fuller LaTeX coverage) would be forced to ship both. Hosts that pre-render math server-side need no client-side renderer at all. The hook interface keeps all three deployment patterns viable. The player's only obligation is to call the hook at the right times; any `(el: HTMLElement) => void | Promise<void>` function satisfies the contract.

**Alternatives considered:**
- Bundle KaTeX inside `@pie-qti/item-player` and enable it by default with an opt-out flag. Rejected: opt-outs are invisible in user-facing bundle analysis; the cost is paid by all hosts.
- Peer dependency on KaTeX with a separate import for hosts that want it. Rejected: peer dependencies still affect the host's dependency graph and documentation burden; the hook model is simpler.
- Ship a "no-math" build and a "with-math" build of the item player. Rejected: maintaining parallel build configurations adds complexity to the monorepo without adding value over the hook pattern.

**Consequences:** Hosts that want math rendering must explicitly import and wire up a typeset function. This is a deliberate, visible choice. The recommended path — `import { typesetMathInElement } from '@pie-qti/typeset-katex'` and passing it as `typeset` — requires two lines of host code.

---

### Dynamic `import()` with module-level cache

**Decision:** `@pie-qti/typeset-katex` loads `katex/contrib/auto-render` via `import('katex/contrib/auto-render')` on first use, and stores the resulting `Promise` in a module-level variable (`let loaded: Promise<...> | null = null`). All subsequent calls to `typesetMathInElement` await the same promise.

**Rationale:** KaTeX's auto-render module is not needed until an item with math is displayed. In a multi-item assessment session, the first math item triggers the load; all subsequent math items reuse the already-loaded module with no additional network cost. Storing the `Promise` (rather than the resolved module) means that concurrent calls on the first math item await the same in-flight load rather than issuing duplicate requests.

**Alternatives considered:**
- Eager static import at module load time. Rejected: this would load KaTeX as soon as any item is rendered, defeating the pre-scan early-exit.
- Import inside each `typesetMathInElement` call without caching. Rejected: modern bundlers deduplicate the module, but the `import()` call would still be resolved on every call; caching the `Promise` is explicit and unambiguous.

**Consequences:** The module-level cache is shared across all call sites on the page. If two host apps independently import `@pie-qti/typeset-katex` and each calls `typesetMathInElement`, they will share the same cached module instance (module identity is determined by URL/bundler chunk, not by caller). This is the desired behavior.

---

### Native MathML rendering with lossless normalization

**Decision:** `typesetMathInElement` keeps authored MathML in the DOM and renders it with the browser's MathML Core engine. It applies only two lossless normalizations first: prefixed MathML is re-namespaced to unprefixed MathML, and `<mfenced>` is expanded into `mrow` + `mo` fences. KaTeX processes only the LaTeX-delimiter text.

**Rationale:** MathML Core is implemented in the browser matrix this framework targets, and authored MathML carries structure (annotations, semantics, nesting) that a LaTeX conversion would drop. The earlier pre-conversion approach silently degraded every MathML construct outside its small handled set; staying native removes that ceiling at zero bundle cost. The `math` element sits in KaTeX's ignored-tag list, so the two systems never fight over the same subtree.

**Alternatives considered:**
- Use MathJax instead of KaTeX — MathJax v3 handles MathML natively. Rejected for the reference implementation because MathJax's async rendering pipeline and larger bundle size are disadvantageous for the assessment player's synchronous-render-then-typeset flow.
- Convert MathML to LaTeX before auto-render — rejected: lossy for anything beyond a small element subset, and redundant now that target browsers render MathML Core.
- Integrate a dedicated MathML→LaTeX library — rejected for the same lossiness, plus a third-party dependency.

**Consequences:** Items containing legacy constructs that MathML Core dropped (beyond `mfenced`, which the normalizer handles) depend on browser-level fallbacks or a host-provided `typeset` implementation. The public contract stays the `typeset` hook: hosts needing a different math pipeline replace it wholesale.

---

### Editable region protection

**Decision:** Before calling KaTeX auto-render, `typesetMathInElement` adds the class `katex-ignore-editor` to every element that has `contenteditable="true"`. After rendering completes, the class is removed.

**Rationale:** KaTeX auto-render mutates the DOM in place — it replaces text nodes containing LaTeX delimiters with structured HTML (`<span class="katex">…</span>`). ProseMirror and TipTap maintain an internal virtual DOM representation that maps to the live DOM; when KaTeX rewrites a text node inside a ProseMirror editor, the editor's internal state becomes inconsistent with the live DOM, causing the editor to break or throw. The `contenteditable` guard prevents KaTeX from scanning inside any editor subtree.

This matters in the PIE-QTI ecosystem because host applications may render QTI content near rich text editors such as TipTap. When an item body contains LaTeX in a prompt that is displayed near an editor, the `typeset` hook can be called on a container that encompasses both rendered item content and the editor — without the guard, the editor would be destroyed.

**Alternatives considered:**
- Pass a narrower `root` element to `typeset` that excludes editor regions. Rejected because the `typeset` hook receives the entire item body container; narrowing would require the caller to know about editor regions, coupling the hook interface to editor implementation details.
- Permanently add `katex-ignore-editor` to editor elements at mount time and never remove it. Rejected because it would add a class to ProseMirror's internal DOM that could interfere with editor styling or selection logic.

**Consequences:** Any `contenteditable="true"` region inside the item body — not just ProseMirror — is excluded from typesetting. This is the safe default. An item that genuinely needs math rendering inside a `contenteditable` element (an unusual scenario) would need a custom `typeset` implementation that manages this exclusion itself.

---

## Extension points

| Extension point | Interface / type | How to use | Example |
|----------------|-----------------|------------|---------|
| Custom math renderer | `typeset?: (el: HTMLElement) => void \| Promise<void>` on `ItemPlayer` props | Provide any function in place of `typesetMathInElement`; it is called on the item body container after render | Pass a MathJax-based function instead of the KaTeX adapter |
| Disable math rendering | Omit `typeset` from `ItemPlayer` props | No function is called; raw LaTeX strings and MathML remain in the DOM | Useful when math is pre-rendered server-side |
| Single-dollar inline math | `enableSingleDollar: true` in `TypesetMathOptions` | Pass the option when constructing the `typeset` callback | `(el) => typesetMathInElement(el, { enableSingleDollar: true })` |
| Custom MathML converter | Provide a custom `typeset` function that calls a dedicated MathML→LaTeX library before invoking KaTeX | Replace the entire hook implementation | Use `mathml-to-latex` or MathJax for comprehensive MathML coverage |
| MutationObserver re-typeset | `observe` option on `typesetAction` (internal Svelte action) | The action automatically re-schedules `typeset` on subtree changes; pass `observe: false` to disable | Disable if content is static and performance profiling shows unnecessary re-triggers |

---

## Data model / contracts

### `typeset` hook contract

```typescript
typeset?: (element: HTMLElement) => void | Promise<void>
```

- The function receives the item body container element as its sole argument.
- It must be idempotent or at least safe to call repeatedly: KaTeX's `ignoredClasses` list (`katex`, `katex-display`) prevents re-processing already-rendered nodes. A custom renderer must implement equivalent protection.
- Errors thrown by `typeset` are caught by the `typesetAction` Svelte action and swallowed; the item body remains with raw text rather than crashing.
- The function is called via `requestAnimationFrame`, so it runs after the browser has painted. It must not assume the element is attached to the document immediately when called.

### `TypesetMathOptions` contract

```typescript
export interface TypesetMathOptions {
  /**
   * If true, also parse single-dollar inline math `$...$`.
   * This is off by default because `$` is common in non-math text.
   */
  enableSingleDollar?: boolean;
}
```

`enableSingleDollar` defaults to `false`. It should only be enabled when the item content catalog is known to use single-dollar delimiters exclusively for math, because any dollar sign in prose text (e.g. "costs $5") will be treated as a math delimiter.

### Delimiter table

| Delimiter | Mode | Enabled by default |
|-----------|------|--------------------|
| `\( … \)` | inline | yes |
| `\[ … \]` | display | yes |
| `$$ … $$` | display | yes |
| `$ … $` | inline | no (opt-in via `enableSingleDollar`) |

### MathML normalization support

| MathML input | Normalization | Notes |
|---------------|-------------|-------|
| `<m:math>`, `<m:frac>`, … (prefixed) | Re-namespaced to unprefixed MathML | The HTML parser only recognizes unprefixed MathML |
| `<mfenced open="[" close="]">` | Expanded to `mrow` + `mo` fences | `mfenced` was removed in MathML Core; defaults `(` / `)` |
| All other authored MathML | Left untouched | Rendered by the browser's MathML Core engine |

### CSS loading contract

KaTeX requires its compiled CSS for correct layout. It must be loaded at the document level:

```typescript
import '@pie-qti/typeset-katex/css';
```

This import must appear in the host application's entry point (or equivalent global CSS bundle). It must not appear inside Shadow DOM components. `packages/default-components/src/shared/components/ShadowBaseStyles.svelte` explicitly omits this import to avoid runtime `@import` 404s in nested routes and to avoid duplicating a large CSS file inside shadow roots.

---

## Acceptance criteria

### Functional

**AC-1: LaTeX delimiters render as typeset math**
```
AC-1: \( … \) inline and \[ … \] display delimiters are typeset by KaTeX
  Given: An item body containing "The value of \(x^2 + 1\) when \(x=3\) is \(10\)."
    and typesetMathInElement is wired as the typeset hook
    and @pie-qti/typeset-katex/css is loaded at the document level
  When: The item body mounts in the DOM
  Then: The three LaTeX expressions render as typeset math spans (class "katex")
  And: The surrounding prose text remains unchanged
```

**AC-2: Double-dollar display math renders**
```
AC-2: $$ … $$ is treated as display math
  Given: An item body containing "$$\frac{a}{b} + \frac{c}{d}$$"
  When: typesetMathInElement is called on the container
  Then: The expression renders as a display-mode KaTeX block (class "katex-display")
```

**AC-3: Single-dollar opt-in is required for $ … $ delimiters**
```
AC-3: Single-dollar $ … $ is ignored when enableSingleDollar is false
  Given: An item body containing "The price is $5 and $x$ is the unknown."
    and typesetMathInElement is called with no options (enableSingleDollar defaults to false)
  When: typesetMathInElement runs
  Then: Neither "$5" nor "$x$" is typeset by KaTeX
  And: The text is preserved as-is

AC-3b: Single-dollar $ … $ is rendered when enableSingleDollar is true
  Given: The same item body
    and typesetMathInElement is called with { enableSingleDollar: true }
  When: typesetMathInElement runs
  Then: "$x$" is typeset as inline math
  Notes: "$5" will also be affected; caller accepts this trade-off
```

**AC-4: Authored MathML stays native**
```
AC-4: <math> content renders through the browser's MathML engine
  Given: An item body containing:
         <math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>
    and typesetMathInElement is wired as the typeset hook
  When: The item body mounts
  Then: The <math> element remains in the DOM (not replaced by KaTeX output)
  And: The fraction renders through MathML Core (or MathJax polyfill where the host provides one)
```

**AC-5: Prefixed MathML is normalized and renders**
```
AC-5: <m:math> prefixed markup renders like unprefixed MathML
  Given: An item body containing <m:math><m:mi>x</m:mi></m:math> (prefixed MathML)
  When: typesetMathInElement runs
  Then: The markup is re-namespaced to unprefixed MathML and renders as math
```

**AC-6: mfenced is expanded losslessly**
```
AC-6: <mfenced> renders its fences under MathML Core
  Given: <math><mfenced open="[" close="]"><mn>1</mn><mn>2</mn></mfenced></math>
  When: typesetMathInElement runs
  Then: The element is expanded to mrow + mo fence markup with the authored open/close characters
  And: The fences render in the browser's MathML output
```

**AC-7: No KaTeX load when item has no math**
```
AC-7: typesetMathInElement returns early with no network request on non-math items
  Given: An item body containing plain HTML prose with no LaTeX delimiters and no <math> elements
  When: typesetMathInElement is called
  Then: The function returns before awaiting loadAutoRender()
  And: No import() of katex/contrib/auto-render is initiated
  Notes: Verify by inspecting network tab — no katex chunk is loaded for this item
```

**AC-8: KaTeX auto-render module is loaded at most once per page**
```
AC-8: Subsequent calls to typesetMathInElement reuse the cached module
  Given: An assessment with three math items rendered in sequence
    and typesetMathInElement is used as the typeset hook
  When: All three items are rendered
  Then: The browser network log shows exactly one request for the katex auto-render chunk
  Notes: The module-level Promise cache prevents duplicate fetches
```

**AC-9: Already-rendered KaTeX nodes are not double-rendered**
```
AC-9: Calling typesetMathInElement twice on the same element does not corrupt the output
  Given: An item body with KaTeX-rendered math (class "katex" is present)
  When: typesetMathInElement is called a second time on the same root element
  Then: The rendered math is unchanged
  And: No additional wrapping spans or mangled LaTeX text is introduced
  Notes: KaTeX's ignoredClasses: ['katex', 'katex-display'] is the mechanism
```

**AC-10: typeset is re-called after response change triggers re-render**
```
AC-10: typesetAction re-runs typeset when the DOM is mutated by a response update
  Given: An item body mounted with typesetAction and a typeset hook
    and the item contains math in a feedbackInline element that appears after a correct response
  When: The candidate selects the correct answer and the feedback becomes visible
  Then: typesetMathInElement is called on the container again
  And: The newly visible math is rendered
  Notes: MutationObserver in typesetAction triggers the re-schedule
```

---

### Accessibility

**AC-A1: KaTeX output includes MathML for screen readers**
```
AC-A1: KaTeX-rendered math is accessible to screen readers
  Given: An item body with typeset math (e.g. \(x^2\))
  When: KaTeX renders the expression
  Then: The rendered DOM contains a <math> element with aria-label or equivalent
        so that screen readers announce the mathematical expression
  Notes: KaTeX produces accessible MathML output by default; verify that
         throwOnError: false and ignoredClasses settings do not suppress it
```

**AC-A2: Typeset math does not receive keyboard focus**
```
AC-A2: KaTeX output elements are not in the tab order
  Given: An item body with multiple typeset math expressions
  When: A keyboard user navigates the item using Tab
  Then: Focus does not land on any KaTeX span or rendered math element
  And: Interactive elements (inputs, buttons) remain reachable in their normal order
```

**AC-A3: Error math renders as visible error indicator, not silence**
```
AC-A3: Malformed LaTeX renders an error indicator, not a blank
  Given: An item body containing \( \frac{x \) (mismatched braces)
  When: typesetMathInElement runs with throwOnError: false
  Then: KaTeX renders a visible error indicator (red error span) in place of the expression
  And: No JavaScript exception is thrown
  And: Surrounding content renders normally
```

---

### Performance

**AC-P1: Pre-scan cost is negligible for non-math items**
```
AC-P1: containsMathDelimiters completes in under 1 ms for a 50 KB item body
  Given: An item body of 50 KB of HTML with no LaTeX or MathML content
  When: typesetMathInElement is called
  Then: The pre-scan completes and returns false in under 1 ms (wall clock)
  And: No dynamic import is initiated
  Notes: The pre-scan is a plain string search on innerHTML; it should be fast
```

**AC-P2: KaTeX CSS is not loaded inside shadow roots**
```
AC-P2: No 404 or duplicate CSS load for KaTeX inside shadow DOM components
  Given: A page with pie-qti-* web components rendered alongside a math item
  When: The page loads
  Then: No HTTP request for katex.min.css originates from inside a shadow root
  And: The host-loaded KaTeX CSS applies to display math rendered in the light DOM
```

---

### Edge cases

**AC-E1: MathML outside the normalizer's scope is left untouched**
```
AC-E1: MathML constructs the normalizer does not handle pass through unchanged
  Given: An item body containing <math><menclose notation="box"><mn>5</mn></menclose></math>
  When: typesetMathInElement runs
  Then: The element is left in the DOM untouched (no conversion, no data loss)
  And: Rendering depends on the browser's MathML Core support for menclose
  And: No exception is thrown
```

**AC-E2: KaTeX output is never re-processed**
```
AC-E2: A second typeset pass does not re-render KaTeX output
  Given: An item body where a previous typeset call has rendered LaTeX into .katex nodes
  When: typesetMathInElement is called a second time
  Then: The .katex subtree is protected (ignored classes and the isProtected check)
  And: The expression is not double-converted
```

**AC-E3: contenteditable editor is unaffected by typeset call**
```
AC-E3: KaTeX does not mutate ProseMirror/TipTap editor nodes
  Given: An item body container that includes both math text (\(x^2\))
         and a TipTap editor element (contenteditable="true")
  When: typesetMathInElement is called on the container
  Then: The math text is rendered by KaTeX
  And: The TipTap editor DOM is unchanged
  And: The editor remains functional (text input, selection, etc. work normally)
  Notes: katex-ignore-editor class is added before and removed after auto-render
```

**AC-E4: Missing KaTeX CSS does not break item rendering**
```
AC-E4: KaTeX renders without CSS (layout may be unstyled, but no crash)
  Given: An item body with typeset math
    and @pie-qti/typeset-katex/css is NOT imported by the host
  When: typesetMathInElement runs
  Then: KaTeX renders the HTML structure (spans, math elements) without error
  And: The item body remains functional (interactions work, text is readable)
  Notes: Display math layout will be incorrect without CSS; this is a host configuration error
```

**AC-E5: typeset function absence is a safe no-op**
```
AC-E5: ItemPlayer renders correctly when no typeset prop is provided
  Given: An ItemPlayer mounted without a typeset prop
    and the item body contains LaTeX delimiters \(x^2\)
  When: The item renders
  Then: The raw LaTeX string is displayed as text (no crash, no console error)
  And: All interactions in the item function normally
```

**AC-E6: MathML conversion error leaves original element in place**
```
AC-E6: Converter error does not corrupt the item body
  Given: An item body containing a <math> element that triggers an exception
         inside the converter (simulated via malformed MathML structure)
  When: typesetMathInElement runs
  Then: The original <math> element is left in the DOM
  And: The error is logged to console.error
  And: typesetMathInElement continues processing the rest of the document
```

---

## Open questions

- [x] **MathML coverage for high school and AP-level content** — resolved 2026-11 by the native-MathML decision: authored MathML of any complexity stays in the DOM and renders through MathML Core, so there is no converter to run out of element types. Hosts targeting engines without MathML Core provide a MathJax-based `typeset` implementation.
- [ ] **SSR / server-side typesetting path:** `typesetMathInElement` is a browser-only function (it uses `document`, `MutationObserver`, `requestAnimationFrame`). The `typesetAction` Svelte action already guards against non-browser environments. A server-side math rendering path (e.g. using KaTeX's server-side API to produce HTML in the item body before delivery) would remove the need for any client-side typesetting. This would be a host-app concern, but it should be documented as a supported deployment pattern and the player's hook interface should be verified to remain a no-op in SSR scenarios.
- [ ] **Single-dollar default-off and QTI content catalogs:** Some QTI content authoring tools export items with single-dollar delimiters as their only math notation. In these catalogs, `enableSingleDollar` must be `true`, but the item player has no way to detect this from the QTI XML. A per-catalog configuration or definition-level `typesetOptions` field would reduce the chance that hosts forget to set `enableSingleDollar` when needed.
- [ ] **`typeset` on modal feedback content:** `ModalFeedbackDisplay.svelte` also accepts a `typeset` prop and passes it to its content container. The typeset action there relies on MutationObserver to pick up newly visible feedback. This path has not been systematically tested for the MathML normalization flow; if modal feedback content can contain prefixed MathML or mfenced, the normalizer must run correctly on that subtree.

---

## Related

- Implementation: `packages/typeset-katex/src/index.ts` — `typesetMathInElement`, `TypesetMathOptions` (the only exports; the LaTeX pre-scan and the MathML normalizer are module-private)
- Implementation: `packages/item-player/src/components/actions/typesetAction.ts` — Svelte action that wires the hook to the DOM lifecycle
- Implementation: `packages/item-player/src/components/ItemBody.svelte` — `use:typesetAction` binding and `typeset` prop threading
- Implementation: `packages/item-player/src/components/ItemPlayer.svelte` — top-level `typeset` prop surface
- Types: Svelte component props — `typeset` rendering hook wiring
- CSS entry point: `packages/typeset-katex/src/css.ts` — re-exports `katex/dist/katex.min.css`
- Adjacent PRDs: `docs/prds/systems/theming.md` — Shadow DOM CSS isolation rationale; explains why KaTeX CSS cannot be bundled inside shadow roots
- KaTeX documentation: https://katex.org/docs/autorender
- QTI MathML usage: see the relevant QTI spec content model for the target version
