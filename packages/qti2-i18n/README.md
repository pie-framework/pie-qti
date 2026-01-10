# @pie-qti/qti2-i18n

Lightweight, type-safe internationalization (i18n) package for the PIE-QTI player ecosystem.

## Features

- ✅ **Type-Safe Translations** - TypeScript autocomplete for all message keys
- ✅ **Runtime Locale Switching** - Change language without page reload
- ✅ **Reactive Updates** - Svelte store integration for automatic UI updates
- ✅ **Web Component Compatible** - Works within Shadow DOM boundaries
- ✅ **Small Bundle Size** - <10 KB gzipped for core + default locale
- ✅ **On-Demand Loading** - Load additional locales asynchronously
- ✅ **Built-in Formatting** - Number and date formatting via `Intl` APIs
- ✅ **26 Languages Supported** - English (4 variants), European languages (13), Asian languages (5), Middle Eastern languages (1), and more

## Installation

```bash
bun add @pie-qti/qti2-i18n
```

## Quick Start

### 1. Initialize i18n

Initialize the i18n system in your application root:

```typescript
import { initI18n } from '@pie-qti/qti2-i18n';

// Initialize with default locale
const i18n = initI18n('en-US');
await i18n.loadLocale('en-US');
```

### 2. Use in Svelte Components

```svelte
<script lang="ts">
  import { t } from '@pie-qti/qti2-i18n';
</script>

<button>{$t('common.submit')}</button>
<p>{$t('assessment.question', { current: 1, total: 10 })}</p>
```

### 3. Add Locale Switcher

```svelte
<script>
  import { LocaleSwitcher } from '@pie-qti/qti2-i18n';
</script>

<LocaleSwitcher />
```

## API Reference

### Core Functions

#### `initI18n(locale: LocaleCode): I18n`

Initialize the i18n singleton with a default locale.

```typescript
import { initI18n } from '@pie-qti/qti2-i18n';

const i18n = initI18n('en-US');
await i18n.loadLocale('en-US');
```

#### `setLocale(locale: LocaleCode): Promise<void>`

Change the current locale (loads if not already loaded).

```typescript
import { setLocale } from '@pie-qti/qti2-i18n';

await setLocale('es-ES'); // Switch to Spanish
```

#### `t` (Svelte Store)

Reactive translation function for use in Svelte components.

```svelte
<script lang="ts">
  import { t } from '@pie-qti/qti2-i18n';
</script>

<!-- Simple translation -->
<button>{$t('common.submit')}</button>

<!-- With interpolation -->
<p>{$t('assessment.question', { current: 1, total: 10 })}</p>

<!-- In JavaScript -->
<script>
  const translate = $t;
  const message = translate('common.loading');
</script>
```

#### `formatNumber` (Svelte Store)

Format numbers according to current locale.

```svelte
<script lang="ts">
  import { formatNumber } from '@pie-qti/qti2-i18n';
</script>

<p>{$formatNumber(1234.56)}</p>
<!-- en-US: "1,234.56" -->
<!-- de-DE: "1.234,56" -->
```

#### `formatDate` (Svelte Store)

Format dates according to current locale.

```svelte
<script lang="ts">
  import { formatDate } from '@pie-qti/qti2-i18n';
</script>

<p>{$formatDate(new Date(), { dateStyle: 'short' })}</p>
<!-- en-US: "1/9/26" -->
<!-- de-DE: "09.01.26" -->
```

### Supported Locales

#### English Variants

| Locale Code | Language                       |
|-------------|--------------------------------|
| `en-US`     | English (United States)        |
| `en-GB`     | English (United Kingdom)       |
| `en-AU`     | English (Australia)            |
| `en-CA`     | English (Canada)               |

#### European Languages

| Locale Code | Language                       |
|-------------|--------------------------------|
| `es-ES`     | Spanish (Spain)                |
| `fr-FR`     | French (France)                |
| `de-DE`     | German (Germany)               |
| `it-IT`     | Italian (Italy)                |
| `pt-BR`     | Portuguese (Brazil)            |
| `nl-NL`     | Dutch (Netherlands)            |
| `pl-PL`     | Polish (Poland)                |
| `cs-CZ`     | Czech (Czech Republic)         |
| `hu-HU`     | Hungarian (Hungary)            |
| `ro-RO`     | Romanian (Romania)             |
| `uk-UA`     | Ukrainian (Ukraine)            |
| `tr-TR`     | Turkish (Turkey)               |
| `fi-FI`     | Finnish (Finland)              |
| `sv-SE`     | Swedish (Sweden)               |
| `da-DK`     | Danish (Denmark)               |
| `nb-NO`     | Norwegian Bokmål (Norway)      |

#### Asian Languages

| Locale Code | Language                       |
|-------------|--------------------------------|
| `zh-CN`     | Chinese Simplified (China)     |
| `ja-JP`     | Japanese (Japan)               |
| `ko-KR`     | Korean (South Korea)           |
| `th-TH`     | Thai (Thailand)                |
| `hi-IN`     | Hindi (India)                  |

#### Middle Eastern Languages

| Locale Code | Language                       |
|-------------|--------------------------------|
| `ar-SA`     | Arabic (Saudi Arabia)          |

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

## Migration Guide

### Migrating Existing Components

1. **Import i18n functions:**
   ```typescript
   import { t } from '@pie-qti/qti2-i18n';
   ```

2. **Replace hardcoded strings:**
   ```svelte
   <!-- Before -->
   <button>Submit</button>

   <!-- After -->
   <button>{$t('common.submit')}</button>
   ```

3. **Handle interpolation:**
   ```svelte
   <!-- Before -->
   <p>Question {current} of {total}</p>

   <!-- After -->
   <p>{$t('assessment.question', { current, total })}</p>
   ```

4. **Update error messages:**
   ```typescript
   // Before
   error = `File type not allowed. Allowed: ${types.join(', ')}`;

   // After
   const translate = $t;
   error = translate('interactions.upload.errorInvalidType', {
     types: types.join(', ')
   });
   ```

### Example Migration

See [FileUpload.svelte](../qti2-default-components/src/shared/components/FileUpload.svelte) for a complete example of a migrated component.

## Bundle Size

| Component                    | Size (gzipped) |
|------------------------------|----------------|
| Core i18n logic              | ~2 KB          |
| English locale (en-US)       | ~8 KB          |
| Additional locale (on-demand)| ~8 KB each     |
| **Total (default)**          | **~10 KB**     |

## Browser Support

All modern browsers with ES2022 support:
- Chrome 94+
- Firefox 93+
- Safari 15.4+
- Edge 94+

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

2. Add to all other locales (maintain same structure)

3. TypeScript will automatically provide type safety for the new key

### Running Tests

```bash
bun test
```

### Building

```bash
bun run build
```

## Architecture

For detailed architecture information, see [i18n-design-plan.md](../../docs/i18n-design-plan.md).

## License

ISC © Renaissance Learning
