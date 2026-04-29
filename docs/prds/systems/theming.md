# PRD: Theming System

<!--
  Status: current
  Type: system
  Packages: @pie-qti/default-components, @pie-qti/player-elements
  Last reviewed: 2026-04-27
-->

**Status:** current  
**Type:** system  
**Packages:** `@pie-qti/default-components`, `@pie-qti/player-elements`  
**Last reviewed:** 2026-04-27

---

## Summary

The PIE-QTI theming system enables interaction web components — which render inside Shadow DOM — to participate in host-page theming without requiring the host to inject CSS into each shadow root. The mechanism has two layers: CSS custom properties (inherited through shadow boundaries) carry palette and surface colors from the host into each component, and `ShadowBaseStyles.svelte` provides a frozen set of DaisyUI-compatible class definitions (`.btn`, `.badge`, `.card`, etc.) bound to those custom properties, so that components render with coherent, readable styling regardless of whether the host loads DaisyUI at all. A `::part()` API exposes named structural elements for host overrides that cannot be expressed via custom properties alone.

---

## Background and rationale

### Why theming is non-trivial for this framework

Interaction components in `@pie-qti/default-components` are Svelte custom elements compiled with `customElement: true`. The browser renders each one inside a Shadow DOM root, which isolates its style scope from the host document. This isolation is intentional for encapsulation but breaks the two mechanisms that DaisyUI v5 and Tailwind CSS normally rely on:

1. **Class-based component styles** (`.btn`, `.badge`, etc.) defined in a host `<style>` or `<link>` sheet are invisible inside the shadow root. The Shadow DOM's style encapsulation boundary explicitly prevents host-defined class rules from applying to shadow content.
2. **Tailwind utility injection**: Tailwind emits classes into the document's stylesheet. The JIT scanner sees the host document's HTML; it does not scan inside custom elements at build time, and it cannot inject its sheet inside shadow roots at runtime.

The consequence is that without a solution, components would render with the browser's default unstyled appearance — black text, native form controls, no layout — regardless of what the host page looks like.

### Why CSS custom properties are the right bridge

CSS custom properties (a.k.a. CSS variables) are inherited values. The cascade does not stop at a Shadow DOM boundary: a custom property set on `:root` or any ancestor in the light DOM is visible to `var()` expressions inside every shadow root on the page. This is the only standards-compliant mechanism for host-to-shadow styling that does not require scripted style injection.

DaisyUI v5 expresses its entire palette through custom properties (`--color-primary`, `--color-base-100`, `--color-success`, etc.) defined on `:root` by the active theme. Because these properties inherit into shadow roots automatically, components bound to `var(--color-primary, <fallback>)` respond to theme switching without any additional code.

### Why ShadowBaseStyles bundles class stubs instead of importing DaisyUI

Interaction components use DaisyUI class names (`.btn`, `.badge`, `.radio`, etc.) internally for consistency with the rest of the framework's component library. Three alternative approaches were considered for making those classes available inside shadow roots:

1. **Import DaisyUI's full stylesheet inside each component's shadow root.** Viable but expensive: DaisyUI's compiled CSS is several hundred kilobytes before tree-shaking. Duplicating it in every shadow root — there can be dozens of interaction components on a single assessment page — causes significant memory overhead and violates the framework's bundle budget.

2. **CSS `@layer` with shadow-specific layers.** `@layer` does not cross shadow boundaries in 2025 browser implementations. This approach requires either a polyfill or abandoning `@layer` semantics entirely.

3. **Constructable stylesheets (`CSSStyleSheet` with `adoptedStyleSheets`).** Constructable stylesheets can be shared across shadow roots via `document.adoptedStyleSheets`. However, sharing a single sheet instance across packages requires coordinating a shared module that every component imports at runtime, adds complexity to the Svelte custom element compilation pipeline, and introduces ordering dependencies between the host's stylesheet and the shared sheet.

The chosen approach — `ShadowBaseStyles.svelte`, a Svelte component containing a frozen subset of DaisyUI-compatible class definitions — is simpler. Each component imports it and renders `<ShadowBaseStyles />` at the top of its template. Svelte hoists the component's styles into the shadow root's adopted stylesheet; the class stubs are co-located with the components that use them. The trade-off is that the subset is frozen: adding a new DaisyUI class to an interaction component also requires adding it to `ShadowBaseStyles.svelte`.

### Why oklch fallback values

DaisyUI v5 uses the oklch color space throughout. Fallback values in `var(--color-primary, oklch(45% 0.24 277))` are chosen to match the DaisyUI v5 default "light" theme's palette in oklch. This means components remain visually coherent even when the host loads no DaisyUI at all — the fallback palette is not generic grey but a reasonable default resembling the framework's own theme. Because oklch is perceptually uniform, color-mix operations used in hover and active states also produce predictable results in the fallback path.

### Why `::part()` is a public API

CSS custom properties cover palette (color, border-radius, font-size tokens) but not structural overrides such as repositioning elements, changing display modes, or applying layout-specific rules to individual parts of a component. The `::part()` pseudo-element lets host stylesheets target specific structural elements in the shadow DOM by name, piercing the encapsulation boundary only for explicitly exposed parts. Part names are declared in the Svelte template via the `part="..."` attribute and follow the QTI element vocabulary (`option`, `label`, `input`, `text`, `prompt`, `root`) to make them predictable across components.

Part names are **public API**. Renaming a part is a breaking change for any host that targets it with `::part()`. This constraint is documented in the extension points table.

### Player-level apps (assessment-player, item-player)

The assessment player and item player applications are not web components. They are SvelteKit applications that load DaisyUI and Tailwind normally: the `<html>` element carries `data-theme="..."`, and all Tailwind utilities and DaisyUI component classes are available throughout the app. Theming for these apps is conventional and does not require the CSS variable bridge. App-level Tailwind configurations (e.g. `apps/transform/tailwind.config.ts`) customize primary and secondary palette values for brand alignment while inheriting all other DaisyUI theme defaults.

---

## Functional requirements

- **FR-1:** Components in `@pie-qti/default-components` must render with coherent, readable styling when no DaisyUI or Tailwind stylesheet is loaded by the host.
- **FR-2:** When the host loads DaisyUI v5 and sets `data-theme` on `<html>`, all interaction components must visually reflect the active theme's palette without any additional host configuration.
- **FR-3:** Every interaction component must include `<ShadowBaseStyles />` at the top of its template before any styled markup.
- **FR-4:** `ShadowBaseStyles.svelte` must provide class definitions for at minimum: `.btn` (all variants and sizes), `.badge` (all variants), `.alert` (all variants), `.card`, `.card-body`, `.divider`, `.select`, `.textarea`, `.radio`, `.checkbox`, `.file-input`, `.label`, `.label-text`, `.form-control`, `.sr-only`, and the Tailwind utilities required by interaction layout.
- **FR-5:** Every CSS declaration in `ShadowBaseStyles.svelte` that references a color must use a `var(--color-*, <fallback>)` expression; no color value may be hardcoded.
- **FR-6:** Every interaction component must expose a `part="root"` on its outermost container element.
- **FR-7:** Interaction components that render repeated items (choices, associations, gap slots, etc.) must expose `part="option"` on each item's wrapper.
- **FR-8:** Part names must follow the vocabulary defined in the extension points table; component-specific deviations must be documented as additions, not replacements.
- **FR-9:** Theme changes (host switches `data-theme`) must be reflected in interaction components without a page reload or any JavaScript intervention — CSS custom property re-evaluation is sufficient.
- **FR-10:** Apps that use DaisyUI's `tailwind.config.ts` may customize `primary`, `secondary`, and other palette tokens; the framework must not hard-code assumptions about specific hex or oklch values for these tokens.

---

## Non-functional requirements

- **Accessibility:** Focus-visible outlines inside shadow roots must use `var(--color-primary, oklch(45% 0.24 277))` so they inherit the host's brand color and meet WCAG 2.2 AA contrast requirements when DaisyUI is active. The fallback oklch value must satisfy a minimum 3:1 contrast ratio against the default background.
- **Performance:** `ShadowBaseStyles.svelte` is included once per component shadow root. The compiled size of `ShadowBaseStyles` must not exceed 8 KB minified. Components should not import DaisyUI's full CSS bundle.
- **Cross-platform:** CSS custom properties and `::part()` are supported in all Chromium, Firefox, and Safari versions released after 2021. No polyfills are required.
- **Security:** `ShadowBaseStyles.svelte` does not accept any props and does not render any user-supplied content; it is a pure style component. Host stylesheets that target `::part()` are subject to the host's CSP, not the shadow root's.
- **i18n:** Theming has no direct i18n surface. RTL layouts that may be required for future ar-SA locale support will need directional overrides; this is an open question (see below).

---

## Design decisions

### CSS custom properties as the sole host-to-shadow color channel

**Decision:** All color values in `ShadowBaseStyles.svelte` and in component-specific `<style>` blocks are expressed as `var(--color-*, <oklch-fallback>)`. No color is hardcoded without a `var()` wrapper.

**Rationale:** CSS custom properties are the only values that the CSS cascade propagates through the Shadow DOM boundary. Class names, Tailwind utilities, and DaisyUI component styles defined in the host document cannot enter a shadow root. Custom properties can. Standardizing on DaisyUI v5's `--color-*` naming means that any host loading DaisyUI v5 gets automatic theme integration at zero additional configuration cost.

**Alternatives considered:**
- Scripted style injection (`element.shadowRoot.adoptedStyleSheets`): requires JavaScript, creates a coupling between the host and each component's shadow root reference, and complicates component teardown.
- Attribute-based theme selection (component reads `data-theme` attribute and applies its own theme map): duplicates DaisyUI's theme data inside the component bundle; does not respond to host-side theme switches without explicit prop updates.
- CSS `@layer` sharing: not available across Shadow DOM in current browser implementations.

**Consequences:** Hosts that do not use DaisyUI must set `--color-primary`, `--color-base-100`, `--color-base-content`, and related properties on `:root` (or on a container wrapping the components) to achieve brand-aligned theming. The full list of required properties is in the Data model / contracts section.

---

### ShadowBaseStyles: bundle a frozen DaisyUI-compatible subset

**Decision:** `ShadowBaseStyles.svelte` contains a manually-maintained subset of DaisyUI class definitions, bound to CSS custom properties. It is included by every interaction component via `<ShadowBaseStyles />`.

**Rationale:** Importing DaisyUI's full CSS inside each shadow root would duplicate hundreds of kilobytes per component instance. A frozen subset containing only the classes that interaction components actually use is an order of magnitude smaller. Co-location in a single file makes audits straightforward: the file is the complete list of what DaisyUI classes are available inside shadow roots.

**Alternatives considered:**
- Import DaisyUI per component: prohibitive memory and bundle cost at scale.
- Constructable stylesheets shared across all component instances: possible but requires a shared singleton module and runtime coordination; adds complexity to the build pipeline.
- CSS `@layer` in shadow roots: not supported across shadow boundaries in current browsers.

**Consequences:** Adding a new DaisyUI class to an interaction component requires also adding its definition to `ShadowBaseStyles.svelte`. There is no automated check for drift between the classes used in component templates and the classes defined in `ShadowBaseStyles`. Reviewers must verify this manually when adding new component markup.

---

### oklch fallback values matching DaisyUI v5 default light theme

**Decision:** Every `var()` fallback in `ShadowBaseStyles.svelte` uses an oklch value taken from DaisyUI v5's default light theme.

**Rationale:** DaisyUI v5 uses oklch throughout. Using matching oklch fallbacks means that components in a no-DaisyUI environment look similar to the DaisyUI default light theme rather than rendering with neutral grey placeholders. The `color-mix(in oklch, ...)` expressions used for hover states and tinted backgrounds also produce correct results when fallback values are oklch.

**Alternatives considered:**
- sRGB hex fallbacks: would require conversion math that introduces perceptual inconsistency in `color-mix` operations; also obscures the relationship to DaisyUI.
- No fallbacks (require DaisyUI): prohibits standalone embedding in non-DaisyUI host apps, which is a supported deployment scenario.

**Consequences:** If DaisyUI changes its default light theme palette in a future major version, the fallback values in `ShadowBaseStyles.svelte` will diverge from the new default. This is acceptable: fallbacks are the "no DaisyUI" path; hosts using DaisyUI get actual theme values. The fallbacks should be updated when the framework upgrades to a new DaisyUI major.

---

### `::part()` names follow QTI element vocabulary

**Decision:** Part names use QTI-vocabulary identifiers (`option`, `label`, `input`, `text`, `prompt`, `root`, `track`, `image`) rather than component-local names.

**Rationale:** Consistent naming across components reduces the learning surface for host authors writing `::part()` overrides. An author who knows that `part="label"` is the `<label>` element in `pie-qti-choice` can correctly infer it is the label in `pie-qti-order`, `pie-qti-associate`, etc. QTI vocabulary is already familiar to integrators of this framework.

**Alternatives considered:**
- Component-prefixed names (e.g. `part="choice-label"`): no ambiguity, but verbose and not transferable across components.
- BEM-style names: adds a naming convention layer not used elsewhere in the framework.

**Consequences:** Part names are public API. Any rename constitutes a breaking change and requires a major version bump in `@pie-qti/default-components`. New structural elements may add new part names freely; removing or renaming existing ones is a breaking change.

---

## Extension points

| Extension point | Interface / type | How to use | Example |
|----------------|-----------------|------------|---------|
| Host palette | CSS custom properties on `:root` | Set `--color-primary`, `--color-base-100`, etc. before components mount | Provide brand colors without loading DaisyUI |
| DaisyUI theme switching | `data-theme` attribute on `<html>` | Change attribute value; CSS custom properties re-evaluate automatically | `document.documentElement.dataset.theme = 'dark'` |
| Structural overrides | `::part(<name>)` selector in host stylesheet | Target exposed part names to override layout, border, spacing | `pie-qti-choice::part(option) { border: 2px solid blue; }` |
| Additional class stubs | `ShadowBaseStyles.svelte` | Add a new `:global(.<class>)` block bound to `var(--color-*)` | Add `.tooltip` definition when a new component needs it |
| App-level brand palette | `tailwind.config.ts` `daisyui.themes` block | Override `primary`, `secondary`, and other tokens per app | Set `primary: '#ee4923'` for PIE brand orange |

---

## Data model / contracts

### CSS custom properties contract

The following custom properties are referenced by `ShadowBaseStyles.svelte` and by component-level `<style>` blocks. When DaisyUI v5 is loaded, all of these are defined by the active theme on `:root`. When DaisyUI is absent, the `var()` fallback values are used. Hosts that want brand-aligned theming without DaisyUI must set these properties on `:root` (or a containing element).

| Property | Fallback value | Role |
|----------|---------------|------|
| `--color-primary` | `oklch(45% 0.24 277)` | Brand / interactive accent color |
| `--color-secondary` | `oklch(65% 0.241 354.308)` | Secondary accent |
| `--color-accent` | `oklch(77% 0.152 181.912)` | Tertiary accent |
| `--color-base-100` | `oklch(100% 0 0)` | Page / component background |
| `--color-base-200` | `oklch(98% 0 0)` | Slightly off-white surface (cards, inputs) |
| `--color-base-300` | `oklch(95% 0 0)` | Border and divider color |
| `--color-base-content` | `oklch(21% 0 0)` | Primary text color |
| `--color-success` | `oklch(76% 0.177 163.223)` | Correct answer / positive feedback |
| `--color-warning` | `oklch(82% 0.189 84.429)` | Warning / attention |
| `--color-error` | `oklch(71% 0.194 13.428)` | Error / incorrect answer |
| `--color-info` | `oklch(74% 0.16 232.661)` | Informational state |

All `color-mix` expressions in the codebase use `in oklch` interpolation. Hosts providing custom values should supply oklch literals or values in a color space that browsers can convert to oklch; sRGB hex values are accepted by the browser but `color-mix` blending results may differ slightly from the oklch-native calculations.

### `::part()` names by component

The following table lists the part names each component exposes. All components expose `part="root"` on the outermost element.

| Component | Additional parts |
|-----------|-----------------|
| `pie-qti-choice` | `option`, `label`, `input`, `text` |
| `pie-qti-order` | `option`, `label`, `input`, `text`, `button` |
| `pie-qti-associate` | `option`, `label`, `input`, `helper`, `prompt` |
| `pie-qti-match` | `option`, `input` |
| `pie-qti-gap-match` | `choice`, `input`, `content`, `palette` |
| `pie-qti-extended-text` | `editor`, `correct-answer` |
| `pie-qti-slider` | `prompt`, `track`, `input`, `min`, `max`, `value`, `value-number` |
| `pie-qti-hotspot` | `image`, `overlay`, `hotspot`, `prompt` |
| `pie-qti-graphic-associate` | `image-area`, `overlay`, `pair`, `correct-pair`, `prompt` |
| `pie-qti-graphic-gap-match` | `image-area`, `overlay`, `placed`, `palette`, `palette-item`, `correct-placed`, `prompt` |
| `pie-qti-graphic-order` | `image-area`, `panel`, `panel-title`, `stage`, `image`, `overlay`, `confirm`, `prompt` |
| `pie-qti-hottext` | `prompt` |
| `pie-qti-select-point` | `stage`, `overlay`, `correct-point` |
| `pie-qti-position-object` | `canvas-area`, `stage`, `canvas`, `overlay` |
| `pie-qti-media` | `stage`, `labels`, `icon`, `ended-message`, `ended-icon` |
| `pie-qti-drawing` | `canvas` |
| `pie-qti-upload` | `button` |
| `pie-qti-end-attempt` | `button` |

### `ShadowBaseStyles.svelte` contract

`ShadowBaseStyles.svelte` accepts no props and renders no DOM. It is a style-only Svelte component. Its only public contract is that, after mounting, the classes listed in FR-4 are available within the shadow root that contains it. The component is located at `packages/default-components/src/shared/components/ShadowBaseStyles.svelte`.

---

## Acceptance criteria

### Functional

**AC-1: Coherent rendering without DaisyUI**
```
AC-1: Components render usably with no host stylesheet
  Given: An HTML page that loads no CSS other than the component's own bundle
  When: A pie-qti-choice component is mounted with valid interaction data
  Then: Radio buttons, choice labels, and the correct-answer badge are all visible
        and no element renders with zero height, invisible text, or missing borders
  Notes: Check that fallback oklch values produce readable contrast
```

**AC-2: Theme palette applied when DaisyUI is active**
```
AC-2: Active DaisyUI theme colors appear in interaction components
  Given: A host page with DaisyUI v5 loaded and data-theme="dark" on <html>
  When: A pie-qti-choice component is mounted
  Then: The component's background color matches --color-base-100 from the dark theme
        and focus rings use --color-primary from the dark theme
```

**AC-3: Theme switch without page reload**
```
AC-3: data-theme change propagates into shadow roots immediately
  Given: A host page with DaisyUI v5 loaded and data-theme="light" on <html>
    and one or more pie-qti-* components are mounted and visible
  When: document.documentElement.dataset.theme is changed to "dark"
  Then: All mounted interaction components reflect the dark theme palette
        within the same animation frame, with no JavaScript event or prop update required
```

**AC-4: Host ::part() override applies**
```
AC-4: ::part() selector targets a named element in the shadow root
  Given: A host stylesheet containing:
         pie-qti-choice::part(option) { border: 3px solid red; }
  When: A pie-qti-choice component is mounted
  Then: Each choice option div has a 3px red border
        and no other elements are affected
```

**AC-5: Custom color properties respected**
```
AC-5: Custom --color-primary on :root overrides fallback
  Given: A host page with no DaisyUI
    and :root { --color-primary: oklch(50% 0.3 30); } in the host stylesheet
  When: A pie-qti-choice component is mounted
    and a radio input is focused
  Then: The focus ring color resolves to oklch(50% 0.3 30)
        not to the fallback oklch(45% 0.24 277)
```

**AC-6: app-level brand token customization**
```
AC-6: App tailwind.config.ts primary override propagates to all components
  Given: The transform app is built with primary: '#ee4923' in tailwind.config.ts
  When: The transform app is loaded in a browser
  Then: --color-primary resolves to a value corresponding to #ee4923 in oklch
        and all DaisyUI primary-colored elements (primary buttons, focus rings) use this color
```

**AC-7: ShadowBaseStyles included in every component**
```
AC-7: .btn class is available inside every interaction component's shadow root
  Given: Any mounted pie-qti-* component
  When: A .btn element exists within the component's shadow root
  Then: The element renders with the button styles from ShadowBaseStyles
        (border-radius, padding, background, hover transitions)
        not with the browser's unstyled block layout
```

**AC-8: Correct-answer highlighting uses success color**
```
AC-8: Correct-answer state uses --color-success
  Given: A pie-qti-choice component mounted with role="scorer"
    and a correctResponse that matches one of the choices
  When: The component renders
  Then: The correct choice's wrapper has a background-color
        derived from --color-success (or its oklch fallback)
        and a border-color matching --color-success
```

---

### Accessibility

**AC-A1: Focus ring visible in all themes**
```
AC-A1: Focus outline meets minimum contrast in every DaisyUI theme
  Given: DaisyUI v5 is loaded with any of its 32 built-in themes
  When: A radio or checkbox input inside a shadow root receives keyboard focus
  Then: The :focus-visible outline is rendered using var(--color-primary)
        and the color contrast between the outline and the adjacent background
        meets WCAG 2.2 AA non-text contrast (3:1 minimum)
  Notes: Verify for at minimum: light, dark, cupcake, dracula, high-contrast themes
```

**AC-A2: Focus ring visible with no DaisyUI**
```
AC-A2: Fallback focus outline is visible without host styles
  Given: A host page with no CSS other than the component bundle
  When: A radio input inside a pie-qti-choice shadow root receives keyboard focus
  Then: A focus outline is rendered using the fallback color oklch(45% 0.24 277)
        and the outline contrasts at 3:1 or better against oklch(100% 0 0) (the base-100 fallback background)
```

**AC-A3: sr-only class hides visually but not from screen readers**
```
AC-A3: .sr-only inside shadow root produces correct visual hiding
  Given: An element inside a shadow root with class="sr-only"
  When: The element is rendered
  Then: The element has zero visible dimensions on screen
        and is still accessible to assistive technology (not display:none or visibility:hidden)
  Notes: Verify using NVDA or VoiceOver that the sr-only element is read aloud
```

---

### Edge cases

**AC-E1: Multiple components on one page share theme changes**
```
AC-E1: Theme switch applies to all mounted components simultaneously
  Given: Twelve pie-qti-* components of different types are all visible on one page
    and DaisyUI v5 is loaded
  When: data-theme on <html> is changed
  Then: All twelve components update their palette in the same paint frame
        with no component remaining on the old theme after the next repaint
```

**AC-E2: Component mounted after theme switch uses current theme**
```
AC-E2: Late-mounted component reads current custom properties
  Given: A host page starts with data-theme="dark"
    and later mounts a new pie-qti-choice component
  When: The component renders for the first time
  Then: It renders with the dark theme palette, not the light theme fallbacks
```

**AC-E3: Missing --color-* property falls back gracefully**
```
AC-E3: Partial custom property set does not break rendering
  Given: A host page that sets --color-primary but not --color-base-100
  When: Any pie-qti-* component is mounted
  Then: Elements that depend on --color-base-100 render with the oklch(100% 0 0) fallback
        and no element renders invisibly or with a CSS parsing error
```

**AC-E4: ::part() names from removed elements do not break host CSS**
```
AC-E4: Nonexistent part name in host CSS is silently ignored
  Given: A host stylesheet containing pie-qti-choice::part(nonexistent) { color: red; }
  When: A pie-qti-choice component is mounted
  Then: No error is thrown or logged
        and the component renders normally
```

**AC-E5: color-mix with oklch fallbacks does not produce invalid color**
```
AC-E5: color-mix fallback expressions produce valid rendered colors
  Given: A host page with no DaisyUI and no custom --color-* properties
  When: A choice component renders a correct-answer highlighted option
        (which uses color-mix(in oklch, var(--color-success, oklch(76% 0.177 163.223)) 8%, transparent))
  Then: The element has a visually distinct tinted background
        and browser DevTools computed styles show a valid color value, not an error
```

---

## Open questions

- [ ] **RTL support for ar-SA**: The theming system currently has no directional layer. Components use `gap-*`, `mr-*`, and `ml-*` classes that are not RTL-aware. When ar-SA locale support is introduced, the theming PRD will need to be updated with a strategy for flipping layout (CSS logical properties, or a `dir="rtl"` attribute cascade).
- [ ] **Automated drift detection for ShadowBaseStyles**: There is no CI check that verifies every DaisyUI class used in component templates also has a definition in `ShadowBaseStyles.svelte`. A linting rule or build-time scanner would prevent silent regressions when components add new class names.
- [ ] **ShadowBaseStyles bundle size gate**: No automated check enforces the 8 KB size budget stated in the non-functional requirements. A bundle size CI step targeting `ShadowBaseStyles` would make violations visible before merge.
- [ ] **Theming contract for custom interaction plugins**: The `pie-qti-custom` element allows third-party plugin components. There is no documented contract for whether custom plugins must also include `<ShadowBaseStyles />` or whether they can rely on a shared instance. This needs a decision before the plugin API is stabilized.

---

## Related

- Implementation: `packages/default-components/src/shared/components/ShadowBaseStyles.svelte`
- Example interaction: `packages/default-components/src/plugins/choice/ChoiceInteraction.svelte`
- App theme config: `apps/transform/tailwind.config.ts`
- Adjacent PRDs: `docs/prds/architecture/web-components.md` (Shadow DOM isolation rationale), `docs/prds/systems/i18n.md` (same Shadow DOM constraint applies to locale propagation)
- DaisyUI v5 theme reference: https://daisyui.com/docs/themes/
- CSS `::part()` spec: https://www.w3.org/TR/css-shadow-parts-1/
- MDN CSS custom properties and Shadow DOM: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
