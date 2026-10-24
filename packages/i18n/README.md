# @pie-qti/i18n

Lightweight, type-safe internationalization (i18n) package for the PIE-QTI player ecosystem.

## Features

- ✅ **Type-Safe Translations** - TypeScript autocomplete for all message keys
- ✅ **Host-Owned Locale** - The host passes the locale in; nothing is read from storage. Persisting to localStorage and reloading on change are opt-in (`SvelteI18nProvider`)
- ✅ **Locale Negotiation** - Any BCP 47 or POSIX tag resolves by language: `es-MX` and `es_ES` reach Spanish, `ar-EG` reaches Arabic
- ✅ **Framework Agnostic** - Core provider works with any JavaScript framework
- ✅ **Svelte Integration** - Simple `$derived` pattern for Svelte 5 components
- ✅ **Web Component Compatible** - Works within Shadow DOM boundaries
- ✅ **Small Bundle Size** - ~10 KB gzipped for core + default locale (verify with your bundler)
- ✅ **On-Demand Loading** - Load additional locales asynchronously
- ✅ **Built-in Formatting** - Number and date formatting via `Intl` APIs
- ✅ **Custom Translations** - Override or extend framework translations
- ✅ **8 Languages Supported** - en (source locale), ar, es, fr, nl, ro, th, zh-Hans

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

// Optional: Load additional locales (any tag for the language works)
await i18n.loadLocale('es-MX');
await i18n.loadLocale('fr');
```

### 2. Use in Components (Svelte 5)

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/i18n';

interface Props {
  i18n?: I18nProvider;  // Always optional
}

let { i18n }: Props = $props();

// Recomputed whenever the i18n prop changes
const translations = $derived({
  submit: i18n?.t('common.submit') ?? 'Submit',
  cancel: i18n?.t('common.cancel') ?? 'Cancel'
});
</script>

<button>{translations.submit}</button>
<button>{translations.cancel}</button>
```

**Note:** `$derived` recomputes when the `i18n` prop changes. A `setLocale()` on the same provider object is not tracked; the host re-renders, passes a new provider or `withLocale()` view, or opts into reload (below).

### 3. Switch Locales

The two providers behave differently:

- `DefaultI18nProvider.setLocale()` is synchronous. It updates the in-memory locale only — it does
  not persist anything and does not reload the page.

  ```typescript
  // In-memory switch only; no persistence, no reload
  i18n.setLocale('es-ES');
  ```

- `SvelteI18nProvider.setLocale()` loads the catalog the locale negotiates to, then switches. It
  persists and reloads only when the host opts in:

  ```typescript
  import { createDefaultSvelteI18nProvider, DEFAULT_LOCALE_STORAGE_KEY } from '@pie-qti/i18n';

  // The host reads its own stored value; the provider never reads storage
  const saved = localStorage.getItem(DEFAULT_LOCALE_STORAGE_KEY) ?? 'en-US';
  const i18n = await createDefaultSvelteI18nProvider(saved, undefined, {
    persistLocale: true,        // write the locale to localStorage on setLocale()
    reloadOnLocaleChange: true, // reload the page after setLocale()
    // storageKey: 'my-app-locale', // defaults to 'pie-qti-locale'
  });

  await i18n.setLocale('es-ES'); // persists, then reloads
  ```

To render a specific player or element in another locale without touching the shared provider, use
the `withLocale(locale)` view instead of `setLocale()`. When that locale's catalog is not loaded yet,
the view renders English and carries a `ready` promise that settles once the catalog arrives; the
player custom elements re-render on it.

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
  readonly ready?: Promise<void>; // set on a withLocale() view still loading its catalog
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

// Load additional locales; resolves without loading for a language with no catalog
await i18n.loadLocale('es-ES');

// Switch locales (synchronous)
i18n.setLocale('es-ES');

// Translate
const text = i18n.t('common.submit');
const interpolated = i18n.t('assessment.question', { current: 1, total: 10 });
```

#### `SvelteI18nProvider`

Svelte-specific wrapper that extends `I18nProvider`:

```typescript
import { createDefaultSvelteI18nProvider } from '@pie-qti/i18n';

// Create Svelte provider; the locale's catalog is loaded before it resolves
const i18n = await createDefaultSvelteI18nProvider('en-US');

// Same API as I18nProvider
const text = i18n.t('common.submit');
await i18n.setLocale('es-ES'); // Loads and switches; no persistence or reload unless opted in
```

### Supported Locales

The framework currently includes 8 catalogs, keyed by language (and by script for Chinese):

| Catalog   | Language              | Served tags (examples)               | Status                      |
|-----------|-----------------------|--------------------------------------|-----------------------------|
| `en`      | English               | `en`, `en-US`, `en-GB`               | ✅ Complete (source locale) |
| `ar`      | Arabic                | `ar`, `ar-SA`, `ar-EG`, `ar_SA`      | ✅ Complete                 |
| `es`      | Spanish               | `es`, `es-ES`, `es-MX`, `es-419`     | ✅ Complete                 |
| `fr`      | French                | `fr`, `fr-FR`, `fr-CA`               | ✅ Complete                 |
| `nl`      | Dutch                 | `nl`, `nl-NL`, `nl-BE`               | ✅ Complete                 |
| `ro`      | Romanian              | `ro`, `ro-RO`                        | ✅ Complete                 |
| `th`      | Thai                  | `th`, `th-TH`                        | ✅ Complete                 |
| `zh-Hans` | Chinese (Simplified)  | `zh`, `zh-CN`, `zh-SG`, `zh-Hans`    | ✅ Complete                 |

A tag walks its RFC 4647 lookup sequence (`es-MX`, then `es`), with the language's CLDR likely script
inserted before the bare language, so `zh-CN` reaches `zh-Hans`. A catalog reached by widening must
share the request's script: `zh-TW`, `zh-HK` and `zh-Hant` do not get the Simplified catalog and
render in English. Any key missing from the resolved catalog falls back to English.
`resolveFrameworkLocale(tag)` answers which catalog serves a tag. The old region-qualified codes
(`es-ES`, `zh-CN`, …) remain valid `FrameworkLocaleCode` inputs.

"Complete" means every English key exists in the locale (verified by the translation coverage
checker below). Values that still match English are reported by the checker as *untranslated*
rather than missing.

**Note:** Additional locales can be provided via custom translations (see below). Custom messages are
matched along the same lookup sequence, so a `de` entry serves `de-AT`.

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

See [en.ts](./src/locales/en.ts) for the complete list of available keys.

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

**Note:** No manual subscriptions needed. Components re-render when the host passes a new provider or view; hosts that change the locale in place opt into reload.

## Bundle Size

| Component                     | Size (gzipped) |
|-------------------------------|----------------|
| Core i18n logic               | ~2 KB          |
| English catalog (en)          | ~8 KB          |
| Additional locale (on-demand) | ~8 KB each     |
| **Total (default)**           | **~10 KB**     |

## Documentation

For detailed guides, see the `docs/` directory:

- **[Integration Guide](./docs/INTEGRATION_GUIDE.md)** - Complete guide for adding i18n to components
- **[Component UI Patterns](./docs/INTEGRATION_GUIDE.md#component-ui-patterns)** - Svelte 5 + DaisyUI patterns and examples
- **[Advanced Features](./docs/ADVANCED_FEATURES.md)** - Pluralization, number & date formatting
- **[Message Keys](./src/locales/en.ts)** - All available translation keys and namespaces

## Development

### Adding New Messages

1. Add to English locale:

   ```typescript
   // src/locales/en.ts
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
bun run scripts/check-translations.ts --locale=nl
```

The checker:

- ✅ **Automatically discovers** all keys from en (no hardcoded lists)
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

- ✅ **Detects hardcoded strings** that match translation values in en
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
