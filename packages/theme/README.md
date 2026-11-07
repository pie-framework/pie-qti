# @pie-qti/theme

Shared QTI player theme tokens.

QTI components consume canonical `--pie-qti-*` CSS variables. Hosts may set
these variables directly or import one of the theme bridges, such as
`@pie-qti/theme-daisyui/bridge.css`.

## Usage

```ts
import '@pie-qti/theme/tokens.css';
```

The default token stylesheet provides readable light and dark fallback palettes:

```html
<div data-qti-theme="dark">
  <pie-qti-item-player></pie-qti-item-player>
</div>
```

Override any token on `:root` or on a container that wraps the player:

```css
.my-player {
  --pie-qti-primary: #146eb3;
  --pie-qti-font-family: 'Atkinson Hyperlegible', sans-serif;
}
```

## Token Contract

### Which token to use

| Purpose | Token | Contrast guarantee (WCAG 2.2 AA) |
| ------- | ----- | -------------------------------- |
| Body text on base surfaces | `--pie-qti-base-content` | ≥ 4.5:1 on `base-100` and `base-200` |
| Message/state **text** (feedback, validation, status) on base surfaces | `--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text` | ≥ 4.5:1 on `base-100` and `base-200` |
| **Fills** (buttons, badges, alert backgrounds) | `--pie-qti-primary`, `--pie-qti-secondary`, `--pie-qti-accent`, `--pie-qti-neutral`, `--pie-qti-info`, `--pie-qti-success`, `--pie-qti-warning`, `--pie-qti-error` | — |
| Text **on a fill** | the fill's `*-content` token, for example `--pie-qti-error-content` on `--pie-qti-error` | ≥ 4.5:1 on its own fill |
| Control **boundaries** (inputs, selects, file inputs) and other non-text cues | `--pie-qti-border-strong` | ≥ 3:1 on `base-100` and `base-200` |
| Focus indicator | `--pie-qti-focus` | ≥ 3:1 on `base-100` and `base-200` |
| Surfaces | `--pie-qti-base-100` (page), `--pie-qti-base-200` (raised/tinted), `--pie-qti-base-300` (subtle dividers) | — |

Rules of thumb:

- Never use a state fill (`--pie-qti-error`, `--pie-qti-success`, …) as a text
  colour: the fills are tuned as backgrounds and fall well below 4.5:1 as text.
- State-coloured non-text cues (icons, correctness outlines) may use the
  matching `*-text` token, which exceeds the 3:1 non-text requirement.
- `--pie-qti-base-300` is a decorative divider colour (about 1.1:1 to 1.2:1);
  do not use it for control boundaries that must be perceivable.
- Draw focus as `outline: 2px solid var(--pie-qti-focus, #4338ca);
  outline-offset: 2px;` on `:focus-visible`, without transparency.
- Colour must not be the only cue: pair state colours with text or an icon
  (WCAG 1.4.1).

The guarantees cover the default palettes in `tokens.css` and are enforced by
`tests/theme-contrast.test.ts`. Hosts that override colour tokens own the
contrast of their overrides. The DaisyUI bridge derives `--pie-qti-focus` and
the `*-content` tokens so that they keep these guarantees in every stock
DaisyUI theme (text on fills in engines with relative colour syntax); see its
[contrast guarantees](../theme-daisyui/README.md#contrast-guarantees).

### Default values and measured contrast

Ratios are against `--pie-qti-base-100` / `--pie-qti-base-200` of the same
theme. The light values equal the fallbacks components use when no theme
stylesheet is loaded.

| Token | Light | Light ratio | Dark | Dark ratio |
| ----- | ----- | ----------- | ---- | ---------- |
| `--pie-qti-base-content` | `oklch(21% 0 0)` | 17.76 / 16.72 | `oklch(97% 0.01 255)` | 14.75 / 15.95 |
| `--pie-qti-error-text` | `#b91c1c` | 6.47 / 6.09 | `#f87171` | 5.79 / 6.26 |
| `--pie-qti-warning-text` | `#92400e` | 7.09 / 6.68 | `#fbbf24` | 9.60 / 10.38 |
| `--pie-qti-success-text` | `#15803d` | 5.02 / 4.72 | `#4ade80` | 9.20 / 9.94 |
| `--pie-qti-info-text` | `#1d4ed8` | 6.70 / 6.31 | `#60a5fa` | 6.30 / 6.82 |
| `--pie-qti-border-strong` | `#767676` | 4.54 / 4.28 | `#9ca3af` | 6.31 / 6.82 |
| `--pie-qti-focus` | `var(--pie-qti-primary)` | 8.32 / 7.84 | `var(--pie-qti-primary)` | 4.28 / 4.63 |

Every `*-content` token reaches at least 4.5:1 on its fill in both themes
(lowest: `--pie-qti-secondary-content` on `--pie-qti-secondary`, 4.85:1 in the
light theme).

### Colour tokens

- `--pie-qti-primary`, `--pie-qti-primary-content`
- `--pie-qti-secondary`, `--pie-qti-secondary-content`
- `--pie-qti-accent`, `--pie-qti-accent-content`
- `--pie-qti-neutral`, `--pie-qti-neutral-content`
- `--pie-qti-base-100`, `--pie-qti-base-200`, `--pie-qti-base-300`, `--pie-qti-base-content`
- `--pie-qti-info`, `--pie-qti-info-content`, `--pie-qti-info-text`
- `--pie-qti-success`, `--pie-qti-success-content`, `--pie-qti-success-text`
- `--pie-qti-warning`, `--pie-qti-warning-content`, `--pie-qti-warning-text`
- `--pie-qti-error`, `--pie-qti-error-content`, `--pie-qti-error-text`
- `--pie-qti-border-strong`
- `--pie-qti-focus`

### Typography, spacing, and shape tokens

These are shared by both themes. The font tokens inherit from the host by
default so players follow the embedding application's typography.

| Token | Default | Use |
| ----- | ------- | --- |
| `--pie-qti-font-family` | `inherit` | Player shell font family |
| `--pie-qti-font-size-base` | `1rem` | Base font size |
| `--pie-qti-line-height` | `1.5` | Body line height |
| `--pie-qti-radius` | `0.5rem` | Containers: cards, panels, alerts |
| `--pie-qti-radius-sm` | `0.25rem` | Small elements: fields, chips |
| `--pie-qti-space-1` | `0.25rem` | Spacing scale step 1 |
| `--pie-qti-space-2` | `0.5rem` | Spacing scale step 2 |
| `--pie-qti-space-3` | `0.75rem` | Spacing scale step 3 |
| `--pie-qti-space-4` | `1rem` | Spacing scale step 4 |
| `--pie-qti-space-5` | `1.5rem` | Spacing scale step 5 |
| `--pie-qti-space-6` | `2rem` | Spacing scale step 6 |
| `--pie-qti-control-min-size` | `2.75rem` | Minimum interactive control size (44px touch target) |

Candidate PNP text appearance (font size, font family, line height) also
updates `--pie-qti-font-size-base`, `--pie-qti-font-family`, and
`--pie-qti-line-height`, so chrome sized from these tokens keeps the
candidate's preferences. PNP colour schemes redraw the message/state text,
border, and focus tokens in the scheme's two colours.

### Dark theme and var() references

`--pie-qti-focus` resolves `var(--pie-qti-primary)` where it is declared, so a
theme that changes `--pie-qti-primary` on a nested container must redeclare
`--pie-qti-focus` there as well (the dark palette does).
