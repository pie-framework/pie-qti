# @pie-qti/i18n

Lightweight, type-safe internationalization (i18n) package for the PIE-QTI player ecosystem.

## Features

- ✅ **Type-Safe Translations** - TypeScript autocomplete for all message keys
- ✅ **Locale Persistence** - Locale persists across page reloads via localStorage (`SvelteI18nProvider`)
- ✅ **Framework Agnostic** - Core provider works with any JavaScript framework
- ✅ **Svelte Integration** - Simple `$derived` pattern for Svelte 5 components
- ✅ **Web Component Compatible** - Works within Shadow DOM boundaries
- ✅ **Small Bundle Size** - ~10 KB gzipped for core + default locale (verify with your bundler)
- ✅ **On-Demand Loading** - Load additional locales asynchronously
- ✅ **Built-in Formatting** - Number and date formatting via `Intl` APIs
- ✅ **Custom Translations** - Override or extend framework translations
- ✅ **8 Languages Supported** - en-US (source locale), ar-SA, es-ES, fr-FR, nl-NL, ro-RO, th-TH, zh-CN

## Installation

```bash
bun add @pie-qti/i18n
```

## Quick Start

### 1. Create i18n Provider

```typescript
import { DefaultI18nProvider } from '@pie-qti/i18n';

// Create provider with default locale
const i18n = new DefaultI18nProvider('en-US');

// Optional: Load additional locales
await i18n.loadLocale('es-ES');
await i18n.loadLocale('fr-FR');
```

### 2. Use in Components (Svelte 5)

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/i18n';

interface Props {
  i18n?: I18nProvider;  // Always optional
}

let { i18n }: Props = $props();

// Simple pattern - locale changes trigger page refresh
const translations = $derived({
  submit: i18n?.t('common.submit') ?? 'Submit',
  cancel: i18n?.t('common.cancel') ?? 'Cancel'
});
</script>

<button>{translations.submit}</button>
<button>{translations.cancel}</button>
```

**Note:** Translations are evaluated once when the component loads. If you need to update translations, the page will reload when the locale changes.

### 3. Switch Locales

The two providers behave differently:

- `DefaultI18nProvider.setLocale()` is synchronous. It updates the in-memory locale only — it does
  not persist anything and does not reload the page.

  ```typescript
  // In-memory switch only; no persistence, no reload
  i18n.setLocale('es-ES');
  ```

- `SvelteI18nProvider.setLocale()` stores the locale in localStorage and triggers a page reload, so
  every component picks up the new locale on the fresh page.

  ```typescript
  // Switch to Spanish (persists to localStorage, then reloads the page)
  await i18n.setLocale('es-ES');

  // On next page load, i18n will automatically use 'es-ES'
  ```

To render a specific player or element in another locale without reloading, use the
`withLocale(locale)` view (available on providers that support it) instead of `setLocale()`.

## API Reference

### Core Provider

#### `I18nProvider` Interface

The framework-agnostic interface for i18n providers:

```typescript
interface I18nProvider {
  getLocale(): string;
  setLocale(locale: string): Promise<void> | void;
  t(key: string, defaultOrValues?: Record<string, any> | string, values?: Record<string, any>): string;
  // Optional members
  plural?(key: string, options: { count: number; [key: string]: any }): string;
  getDirection?(): 'ltr' | 'rtl';
  withLocale?(locale: string): I18nProvider;
  formatNumber?(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate?(date: Date, options?: Intl.DateTimeFormatOptions): string;
}
```

#### `DefaultI18nProvider`

Basic implementation without framework-specific features:

```typescript
import { DefaultI18nProvider } from '@pie-qti/i18n';

// Create with default locale
const i18n = new DefaultI18nProvider('en-US');

// With custom messages
const customMessages = {
  'es-ES': {
    common: { submit: 'Enviar' }
  }
};
const i18n = new DefaultI18nProvider('en-US', customMessages);

// Load additional locales
await i18n.loadLocale('es-ES');

// Switch locales
await i18n.setLocale('es-ES');

// Translate
const text = i18n.t('common.submit');
const interpolated = i18n.t('assessment.question', { current: 1, total: 10 });
```

#### `SvelteI18nProvider`

Svelte-specific wrapper that extends `I18nProvider`:

```typescript
import { createDefaultSvelteI18nProvider } from '@pie-qti/i18n';

// Create Svelte provider
const i18n = await createDefaultSvelteI18nProvider('en-US');

// Same API as I18nProvider
const text = i18n.t('common.submit');
await i18n.setLocale('es-ES'); // Persists to localStorage and triggers a page reload
```

### Supported Locales

The framework currently includes 8 locales:

| Locale Code | Language                  | Status                        |
|-------------|---------------------------|-------------------------------|
| `en-US`     | English (United States)   | ✅ Complete (source locale)   |
| `ar-SA`     | Arabic (Saudi Arabia)     | ✅ Complete                   |
| `es-ES`     | Spanish (Spain)           | ✅ Complete                   |
| `fr-FR`     | French (France)           | ✅ Complete                   |
| `nl-NL`     | Dutch (Netherlands)       | ✅ Complete                   |
| `ro-RO`     | Romanian (Romania)        | ✅ Complete                   |
| `th-TH`     | Thai (Thailand)           | ✅ Complete                   |
| `zh-CN`     | Chinese (Simplified)      | ✅ Complete                   |

"Complete" means every en-US key exists in the locale (verified by the translation coverage
checker below). Values that still match English are reported by the checker as *untranslated*
rather than missing.

**Note:** Additional locales can be provided via custom translations (see below).

## Message Keys

All translation keys are type-safe. Your IDE will provide autocomplete for available keys:

```typescript
// ✅ Valid keys (autocomplete provided)
$t('common.submit')
$t('interactions.upload.label')
$t('assessment.question', { current: 1, total: 10 })

// ❌ TypeScript error - invalid key
$t('invalid.key')
```

### Common Message Namespaces

- `common.*` - Shared UI text (buttons, labels)
- `units.*` - Unit formatting (bytes, time)
- `validation.*` - Form validation messages
- `interactions.*` - QTI interaction-specific text
- `assessment.*` - Assessment player UI
- `accessibility.*` - ARIA labels and screen reader text

See [en-US.ts](./src/locales/en-US.ts) for the complete list of available keys.

## Custom Translations

You can provide your own translations or override framework translations:

```typescript
import { DefaultI18nProvider } from '@pie-qti/i18n';

const customMessages = {
  // Add a new locale
  'de-DE': {
    common: {
      submit: 'Einreichen',
      next: 'Weiter',
      previous: 'Zurück',
    },
    interactions: {
      upload: {
        label: 'Datei hochladen',
      },
    }
  },
  // Override specific framework translations
  'en-US': {
    common: {
      submit: 'Send Answer', // Brand-specific terminology
    }
  }
};

const i18n = new DefaultI18nProvider('en-US', customMessages);
```

Custom translations have higher priority than framework translations, so you can selectively override specific keys while keeping the rest.

## Component Integration

### Recommended Pattern (Svelte 5)

The recommended approach is simple: use `$derived` to create memoized translations.

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/i18n';

interface Props {
  i18n?: I18nProvider;
}

let { i18n }: Props = $props();

// Memoized translations - evaluated once when component loads
const translations = $derived({
  submit: i18n?.t('common.submit') ?? 'Submit',
  cancel: i18n?.t('common.cancel') ?? 'Cancel'
});
</script>

<button class="btn btn-primary">{translations.submit}</button>
<button class="btn btn-outline">{translations.cancel}</button>
```

### Inline Pattern (For Simple Cases)

For one-off translations, you can call `t()` directly:

```svelte
<button>{i18n?.t('common.submit') ?? 'Submit'}</button>
```

### Helper Pattern (For Cleaner Code)

Create a translation helper for repeated use:

```svelte
<script lang="ts">
const t = $derived((key: string, fallback: string) => i18n?.t(key) ?? fallback);
</script>

<button>{t('common.submit', 'Submit')}</button>
<button>{t('common.cancel', 'Cancel')}</button>
```

### Web Components

Web components receive i18n as a property:

```typescript
interface Props {
  i18n?: I18nProvider;
}

let { i18n = $bindable() }: Props = $props();

const t = $derived((key: string, fallback: string) => i18n?.t(key) ?? fallback);
```

**Note:** No manual subscriptions or reactivity tracking needed. Locale changes trigger a page reload, so components always render with the correct locale.

## Bundle Size

| Component                     | Size (gzipped) |
|-------------------------------|----------------|
| Core i18n logic               | ~2 KB          |
| English locale (en-US)        | ~8 KB          |
| Additional locale (on-demand) | ~8 KB each     |
| **Total (default)**           | **~10 KB**     |

## Documentation

For detailed guides, see the `docs/` directory:

- **[Integration Guide](./docs/INTEGRATION_GUIDE.md)** - Complete guide for adding i18n to components
- **[Component UI Patterns](./docs/INTEGRATION_GUIDE.md#component-ui-patterns)** - Svelte 5 + DaisyUI patterns and examples
- **[Advanced Features](./docs/ADVANCED_FEATURES.md)** - Pluralization, number & date formatting
- **[Message Keys](./src/locales/en-US.ts)** - All available translation keys and namespaces

## Development

### Adding New Messages

1. Add to English locale:

   ```typescript
   // src/locales/en-US.ts
   export default {
     myFeature: {
       newMessage: 'My new message',
     },
   } as const;
   ```

2. Add to other locales (maintain same structure)

3. Run translation coverage checker:

   ```bash
   bun run check-translations
   ```

4. TypeScript automatically provides type safety for the new key

### Translation Coverage Checker

The package includes an automated translation coverage checker that ensures all locales maintain 100% coverage:

```bash
# Check all locales
bun run check-translations

# Check specific locale
bun run scripts/check-translations.ts --locale nl-NL
```

The checker:

- ✅ **Automatically discovers** all keys from en-US (no hardcoded lists)
- ✅ **Automatically detects** all locale files (no configuration)
- ✅ **Reports missing keys** in other locales
- ✅ **Detects obsolete keys** that should be removed
- ✅ **Runs in CI/CD** to block PRs with incomplete translations

**Integrated into build:**

```bash
bun run build  # Automatically checks translations first
```

See [`scripts/check-translations.ts`](./scripts/check-translations.ts) for the checker's behavior
and options.

### Hardcoded String Scanner

The package includes a scanner that detects hardcoded English strings in component files that should use i18n:

```bash
# Scan default components package
bun run scan-hardcoded

# Scan a custom path
bun run scan-hardcoded --path=../custom-components
```

The scanner:

- ✅ **Detects hardcoded strings** that match translation values in en-US
- ✅ **Suggests the correct i18n key** to use for each match
- ✅ **Scans .svelte and .ts files** recursively
- ✅ **Provides exact replacement code** for each hardcoded string

**Example output:**

```text
📄 plugins/graphic-order/GraphicOrderInteraction.svelte (1 match)
────────────────────────────────────────────────────────────────
  Line 138: <h3>Order (drag to reorder)</h3>
           Use: i18n?.t('interactions.graphicOrder.orderHeading') ?? 'Order (drag to reorder)'
```

This tool helps maintain consistency by ensuring all user-facing strings use the i18n system.

### Running Tests

```bash
bun test
```

### Building

```bash
# Build with translation check
bun run build

# Build without translation check (emergency use only)
bun run build:skip-check
```

## License

MIT
