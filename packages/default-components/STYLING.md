# Styling Contract (Shadow DOM + QTI Theme Tokens + ::part)

This package ships QTI interaction renderers as **web components** (Svelte custom elements). They render in **Shadow DOM** for encapsulation and portability.

To make them themeable by the host (e.g. a QTI player shell using DaisyUI) while remaining framework-agnostic, the styling contract is:

- Components **own layout/accessibility CSS** (so they render correctly with *zero* host CSS).
- Components **consume theme tokens via CSS variables** (so the host controls colors/typography/radii).
- Components expose stable **`part="..."` hooks** so host pages can refine styling via `::part(...)` without breaking encapsulation.

## Theme Tokens

The components consume canonical PIE QTI CSS variables:

- `--pie-qti-primary`: primary / interactive accent
- `--pie-qti-accent`: accent
- `--pie-qti-base-100`, `--pie-qti-base-200`, `--pie-qti-base-300`: base surfaces
- `--pie-qti-base-content`: primary text
- `--pie-qti-success`: correct answer / positive feedback
- `--pie-qti-warning`: warning states
- `--pie-qti-error`: error / incorrect states
- `--pie-qti-info`: informational states
- `--pie-qti-focus`: focus indicator

These variables are exported as defaults by `@pie-qti/theme/tokens.css`. DaisyUI hosts should import `@pie-qti/theme-daisyui/bridge.css` once to map the active DaisyUI `--color-*` theme into the QTI token contract.

If the host does not provide QTI tokens, components fall back to safe oklch defaults via `var(--pie-qti-*, fallback)`.

### Host responsibilities (recommended)

- Load your theme and set `--pie-qti-*` variables on `:root` or any ancestor of the web component.
- If you use DaisyUI, import `@pie-qti/theme-daisyui/bridge.css` and set `data-theme="..."` normally.

## `::part` hooks

### `pie-qti-order` (`orderInteraction`)

Parts:

- `list`: the container holding the reorderable list
- `item`: a single draggable item row (button)
- `index`: the item index badge
- `handle`: the drag handle icon
- `text`: the item label text

Example:

```css
pie-qti-order::part(item) {
  border-radius: 12px;
}

pie-qti-order::part(handle) {
  opacity: 0.9;
}
```

### `pie-qti-match` (`matchInteraction`)

Parts:

- `grid`: overall two-column layout container
- `source-column`, `source-heading`
- `target-column`, `target-heading`
- `source-item`: draggable source button
- `source-handle`: drag handle icon inside the source item
- `source-clear`: “clear match” button
- `target`: drop zone/target button

Example:

```css
pie-qti-match::part(target) {
  border-style: solid;
}
```

## Regression guarantee (no-host-CSS)

The repo includes a Playwright regression test that renders `pie-qti-order` and `pie-qti-match` in an iframe with **no Tailwind/DaisyUI loaded** and asserts that SVG handles do not fall back to browser-default sizing.

See: `apps/demo/tests/playwright/no-host-css.pw.ts`

## Baseline class styling (Shadow DOM)

The default web components include a small baseline stylesheet (`ShadowBaseStyles`) to provide minimal styling for common DaisyUI classnames (e.g. `btn`, `alert`, `badge`, `card`, `select`) **inside Shadow DOM** when the host does not load DaisyUI/Tailwind CSS.

File: `src/shared/components/ShadowBaseStyles.svelte`

### `pie-qti-hotspot` (`hotspotInteraction`)

Parts:

- `prompt`: prompt text
- `stage`: container holding the image + overlay
- `image`: the rendered image/SVG container
- `overlay`: SVG overlay that contains the hotspot shapes (positioned absolutely)
- `selected`: “Selected: …” message container

Notes:

- The interactive hotspot shapes are SVG elements inside `overlay`. The component includes a real CSS `:hover` fallback so hover feedback works even when Tailwind `hover:` utilities are not present.

### `pie-qti-graphic-gap-match` (`graphicGapMatchInteraction`)

Parts:

- `prompt`: prompt text
- `region`: container for labels + stage
- `labels`: labels palette container
- `label-remove`: remove button next to a matched label
- `stage`: container holding the image + overlay
- `overlay`: SVG overlay for hotspots

### `pie-qti-graphic-order` (`graphicOrderInteraction`)

Parts:

- `prompt`
- `layout`
- `image-area`
- `stage`
- `panel`
- `panel-title`
- `list`
- `item`
- `handle-icon`
- `confirm`
- `confirmed-icon`

### `pie-qti-position-object` (`positionObjectInteraction`)

Parts:

- `prompt`
- `layout`
- `canvas-area`
- `canvas`
- `placed`
- `remove`
- `palette`
- `palette-item`
- `drag-icon`

### `pie-qti-graphic-associate` (`graphicAssociateInteraction`)

Parts:

- `prompt`
- `layout`
- `image-area`
- `stage`
- `overlay`
- `hotspot`
- `panel`

### `pie-qti-choice` (`choiceInteraction`)

Parts:

- `root`
- `option`
- `label`
- `input`
- `text`

### `pie-qti-slider` (`sliderInteraction`)

Parts:

- `root`
- `prompt`
- `track`
- `min`
- `input`
- `max`
- `value`
- `value-number`

### `pie-qti-gap-match` (`gapMatchInteraction`)

Parts:

- `root`
- `prompt`
- `palette`
- `word`
- `text`
- `gap`

### `pie-qti-hottext` (`hottextInteraction`)

Parts:

- `root`
- `prompt`
- `content`
- `footer`

### `pie-qti-associate` (`associateInteraction`)

Parts:

- `root`
- `prompt`
- `choices`
- `choice`
- `pairs-title`
- `pairs`
- `pair`
- `pair-remove`
- `helper`

### `pie-qti-custom` (`customInteraction`)

Parts:

- `root` (on the `pie-qti-custom` wrapper)
- `root`, `warning`, `manual`, `manual-label`, `manual-input`, `toggle`, `details`, `details-title`, `attributes`, `xml` (from `CustomInteractionFallback`)

### `pie-qti-extended-text` (`extendedTextInteraction`)

Parts:

- `root`
- `editor`

The rich text editor component also exposes parts:

- `root`, `toolbar`, `toolbar-button`, `toolbar-divider`, `editor`


