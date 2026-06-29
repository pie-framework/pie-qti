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

## Token Contract

Core tokens include:

- `--pie-qti-primary`
- `--pie-qti-secondary`
- `--pie-qti-accent`
- `--pie-qti-base-100`
- `--pie-qti-base-200`
- `--pie-qti-base-300`
- `--pie-qti-base-content`
- `--pie-qti-info`
- `--pie-qti-success`
- `--pie-qti-warning`
- `--pie-qti-error`
- `--pie-qti-focus`
