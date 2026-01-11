# @pie-qti/qti2-i18n

Lightweight, type-safe internationalization (i18n) package for the PIE-QTI player ecosystem.

## Features

- ✅ **Type-Safe Translations** - TypeScript autocomplete for all message keys
- ✅ **Locale Persistence** - Locale persists across page reloads via localStorage
- ✅ **Framework Agnostic** - Core provider works with any JavaScript framework
- ✅ **Svelte Integration** - Simple `$derived` pattern for Svelte 5 components
- ✅ **Web Component Compatible** - Works within Shadow DOM boundaries
- ✅ **Small Bundle Size** - <10 KB gzipped for core + default locale
- ✅ **On-Demand Loading** - Load additional locales asynchronously
- ✅ **Built-in Formatting** - Number and date formatting via `Intl` APIs
- ✅ **Custom Translations** - Override or extend framework translations
- ✅ **6 Languages Supported** - en-US (complete), es-ES, fr-FR, nl-NL, ro-RO, th-TH

## Installation

```bash
bun add @pie-qti/qti2-i18n
```

## Quick Start

### 1. Create i18n Provider

```typescript
import { DefaultI18nProvider } from '@pie-qti/qti2-i18n';

// Create provider with default locale
const i18n = new DefaultI18nProvider('en-US');

// Optional: Load additional locales
await i18n.loadLocale('es-ES');
await i18n.loadLocale('fr-FR');
```

### 2. Use in Components (Svelte 5)

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/qti2-i18n';

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

```typescript
// Switch to Spanish (triggers page reload)
await i18n.setLocale('es-ES');

// Locale is stored in localStorage and persists across reloads
// On next page load, i18n will automatically use 'es-ES'
```

**Important:** Calling `setLocale()` stores the locale in localStorage and triggers a page reload. This simplifies the codebase by eliminating complex reactivity patterns.

## API Reference

### Core Provider

#### `I18nProvider` Interface

The framework-agnostic interface for i18n providers:

```typescript
interface I18nProvider {
  getLocale(): string;
  setLocale(locale: string): Promise<void>;
  loadLocale(locale: string): Promise<void>;
  t(key: string, values?: Record<string, any>): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string;
}
```

#### `DefaultI18nProvider`

Basic implementation without framework-specific features:

```typescript
import { DefaultI18nProvider } from '@pie-qti/qti2-i18n';

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
import { createDefaultSvelteI18nProvider } from '@pie-qti/qti2-i18n';

// Create Svelte provider
const i18n = await createDefaultSvelteI18nProvider('en-US');

// Same API as I18nProvider
const text = i18n.t('common.submit');
await i18n.setLocale('es-ES'); // Triggers page reload

// Deprecated reactive stores (kept for backwards compatibility)
// Note: These are no longer needed since locale changes trigger page reload
const { locale, t$, plural$, formatNumber$, formatDate$ } = i18n;
```

**Migration Note:** The reactive stores (`locale`, `t$`, `plural$`, etc.) are deprecated. Use the direct methods (`t()`, `plural()`, etc.) with `$derived` instead. See the Quick Start section for the recommended pattern.

### Supported Locales

The framework currently includes 6 locales:

| Locale Code | Language                  | Status                   |
|-------------|---------------------------|--------------------------|
| `en-US`     | English (United States)   | ✅ Complete (300+ keys)  |
| `es-ES`     | Spanish (Spain)           | 🚧 ~80% complete         |
| `fr-FR`     | French (France)           | 🚧 ~70% complete         |
| `nl-NL`     | Dutch (Netherlands)       | 🚧 ~30% complete         |
| `ro-RO`     | Romanian (Romania)        | 🚧 ~30% complete         |
| `th-TH`     | Thai (Thailand)           | 🚧 ~30% complete         |

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
import { DefaultI18nProvider } from '@pie-qti/qti2-i18n';

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
import type { I18nProvider } from '@pie-qti/qti2-i18n';

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
- **[Component Patterns](./docs/COMPONENT_PATTERNS.md)** - Svelte 5 + DaisyUI patterns and examples
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

3. TypeScript automatically provides type safety for the new key

### Running Tests

```bash
bun test
```

### Building

```bash
bun run build
```

## License

ISC © Renaissance Learning
