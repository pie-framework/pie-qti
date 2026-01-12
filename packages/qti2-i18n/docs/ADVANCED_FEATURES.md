# Advanced i18n Features

This guide covers advanced internationalization features including pluralization, number formatting, and date formatting.

## Table of Contents

- [Pluralization](#pluralization)
- [Number Formatting](#number-formatting)
- [Date and Time Formatting](#date-and-time-formatting)
- [Best Practices](#best-practices)

## Pluralization

Pluralization handles different word forms based on count (e.g., "1 item" vs "2 items").

### Basic Usage

The i18n provider includes an optional `plural()` method that selects the correct form based on count:

```typescript
// In your component
const translations = $derived({
  itemCount: (count: number) =>
    i18n?.plural?.('plurals.items', { count }) ??
    `${count} item(s)`,
});

// Usage in template
{translations.itemCount(1)}  // "1 item"
{translations.itemCount(5)}  // "5 items"
```

### How It Works

The `plural()` method uses a simple rule:
- If `count === 1`, uses `{key}.one`
- Otherwise, uses `{key}.other`

Example locale structure:

```typescript
// en-US.ts
export default {
  plurals: {
    items: {
      one: '{count} item',
      other: '{count} items',
    },
  },
};
```

### Available Plural Forms

The framework includes plural forms for common scenarios:

| Key | Singular (count=1) | Plural (count≠1) |
|-----|-------------------|------------------|
| `plurals.items` | "1 item" | "N items" |
| `plurals.files` | "1 file selected" | "N files selected" |
| `plurals.questions` | "1 question" | "N questions" |
| `plurals.answers` | "1 answer" | "N answers" |
| `plurals.choices` | "1 choice" | "N choices" |
| `plurals.attempts` | "1 attempt remaining" | "N attempts remaining" |
| `plurals.minutesRemaining` | "1 minute remaining" | "N minutes remaining" |
| `plurals.secondsRemaining` | "1 second remaining" | "N seconds remaining" |

### Complete Example

```svelte
<script lang="ts">
  import type { I18nProvider } from '@pie-qti/qti2-i18n';

  interface Props {
    selectedCount: number;
    i18n?: I18nProvider;
  }

  let { selectedCount, i18n }: Props = $props();

  const translations = $derived({
    itemsSelected: (count: number) =>
      i18n?.plural?.('plurals.items', { count }) ??
      `${count} item(s)`,
  });
</script>

<div class="selection-info">
  <p>{translations.itemsSelected(selectedCount)}</p>
</div>
```

### Adding Custom Plural Forms

To add new plural forms to your locale:

```typescript
// locales/en-US.ts
export default {
  plurals: {
    // Add your custom plural
    participants: {
      one: '{count} participant',
      other: '{count} participants',
    },
    errors: {
      one: '{count} error found',
      other: '{count} errors found',
    },
  },
};
```

Then translate to other locales:

```typescript
// locales/es-ES.ts
export default {
  plurals: {
    participants: {
      one: '{count} participante',
      other: '{count} participantes',
    },
    errors: {
      one: '{count} error encontrado',
      other: '{count} errores encontrados',
    },
  },
};
```

### Pluralization with Additional Variables

You can pass additional interpolation values along with count:

```typescript
const translations = $derived({
  filesInFolder: (count: number, folder: string) =>
    i18n?.plural?.('plurals.filesInFolder', { count, folder }) ??
    `${count} file(s) in ${folder}`,
});

// In locale:
plurals: {
  filesInFolder: {
    one: '{count} file in {folder}',
    other: '{count} files in {folder}',
  },
}

// Usage:
{translations.filesInFolder(3, 'Documents')}
// "3 files in Documents"
```

### Fallback Behavior

If `i18n?.plural` is not available (e.g., custom provider without plural support), provide a fallback:

```typescript
const translations = $derived({
  items: (count: number) =>
    i18n?.plural?.('plurals.items', { count }) ??
    i18n?.t('plurals.items.other', { count }) ??
    `${count} item(s)`,
});
```

### Languages Without Plurals

Some languages (like Thai, Chinese, Japanese) don't have plural forms. For these, use the same text for both:

```typescript
// th-TH.ts (Thai)
plurals: {
  items: {
    one: '{count} รายการ',    // Same for both
    other: '{count} รายการ',
  },
}
```

### Complex Pluralization

For languages with complex plural rules (Russian, Arabic, Polish), you may need to use a more sophisticated i18n library like [Intl.PluralRules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules):

```typescript
// Custom provider with complex pluralization
class ComplexI18nProvider implements I18nProvider {
  plural(key: string, options: { count: number; [key: string]: any }): string {
    const pluralRules = new Intl.PluralRules(this.locale);
    const rule = pluralRules.select(options.count); // 'zero', 'one', 'two', 'few', 'many', 'other'

    return this.t(`${key}.${rule}`, options);
  }
}
```

## Number Formatting

Format numbers according to locale conventions (decimal separators, thousands grouping, currency symbols).

### Basic Usage

```typescript
const translations = $derived({
  price: (amount: number) =>
    i18n?.formatNumber?.(amount, { style: 'currency', currency: 'USD' }) ??
    `$${amount}`,

  percentage: (value: number) =>
    i18n?.formatNumber?.(value, { style: 'percent' }) ??
    `${value}%`,

  fileSize: (bytes: number) =>
    i18n?.formatNumber?.(bytes, { maximumFractionDigits: 2 }) ??
    String(bytes),
});

// Usage:
{translations.price(1299.99)}      // "$1,299.99" (en-US)
                                    // "1 299,99 $" (fr-FR)

{translations.percentage(0.856)}    // "85.6%" (en-US)
                                    // "85,6 %" (fr-FR)

{translations.fileSize(1234567)}    // "1,234,567" (en-US)
                                    // "1 234 567" (fr-FR)
```

### Number Format Options

All [Intl.NumberFormat options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat) are supported:

```typescript
// Currency formatting
i18n?.formatNumber?.(99.95, {
  style: 'currency',
  currency: 'EUR',
  currencyDisplay: 'symbol', // or 'code', 'name'
});

// Percentage formatting
i18n?.formatNumber?.(0.5, {
  style: 'percent',
  minimumFractionDigits: 2,
});

// Decimal formatting
i18n?.formatNumber?.(1234.5678, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Compact notation
i18n?.formatNumber?.(1500000, {
  notation: 'compact',
  compactDisplay: 'short', // or 'long'
});
// "1.5M" (en-US), "1,5 M" (fr-FR)
```

### Complete Example

```svelte
<script lang="ts">
  import type { I18nProvider } from '@pie-qti/qti2-i18n';

  interface Props {
    score: number;
    maxScore: number;
    i18n?: I18nProvider;
  }

  let { score, maxScore, i18n }: Props = $props();

  const percentage = $derived((score / maxScore) * 100);

  const translations = $derived({
    score: i18n?.formatNumber?.(score) ?? String(score),
    maxScore: i18n?.formatNumber?.(maxScore) ?? String(maxScore),
    percentage: i18n?.formatNumber?.(percentage / 100, {
      style: 'percent',
      maximumFractionDigits: 1,
    }) ?? `${percentage}%`,
  });
</script>

<div class="score-display">
  <p>Score: {translations.score} / {translations.maxScore}</p>
  <p>Percentage: {translations.percentage}</p>
</div>
```

## Date and Time Formatting

Format dates and times according to locale conventions.

### Basic Usage

```typescript
const now = new Date();

const translations = $derived({
  date: i18n?.formatDate?.(now, { dateStyle: 'medium' }) ??
    now.toLocaleDateString(),

  time: i18n?.formatDate?.(now, { timeStyle: 'short' }) ??
    now.toLocaleTimeString(),

  dateTime: i18n?.formatDate?.(now, {
    dateStyle: 'short',
    timeStyle: 'short',
  }) ?? now.toLocaleString(),
});

// Usage:
{translations.date}      // "Jan 10, 2026" (en-US)
                         // "10 janv. 2026" (fr-FR)

{translations.time}      // "3:30 PM" (en-US)
                         // "15:30" (fr-FR)

{translations.dateTime}  // "1/10/26, 3:30 PM" (en-US)
                         // "10/01/2026 15:30" (fr-FR)
```

### Date Format Options

All [Intl.DateTimeFormat options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) are supported:

```typescript
// Short, medium, long, full date styles
i18n?.formatDate?.(date, { dateStyle: 'full' });
// "Friday, January 10, 2026" (en-US)
// "vendredi 10 janvier 2026" (fr-FR)

// Custom format
i18n?.formatDate?.(date, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

// Time with seconds
i18n?.formatDate?.(date, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// 24-hour vs 12-hour format
i18n?.formatDate?.(date, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false, // Use 24-hour format
});
```

### Complete Example

```svelte
<script lang="ts">
  import type { I18nProvider } from '@pie-qti/qti2-i18n';

  interface Props {
    deadline: Date;
    i18n?: I18nProvider;
  }

  let { deadline, i18n }: Props = $props();

  const now = new Date();
  const timeRemaining = $derived(deadline.getTime() - now.getTime());
  const minutesRemaining = $derived(Math.floor(timeRemaining / 60000));

  const translations = $derived({
    deadlineDate: i18n?.formatDate?.(deadline, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }) ?? deadline.toLocaleString(),

    minutesLeft: (count: number) =>
      i18n?.plural?.('plurals.minutesRemaining', { count }) ??
      `${count} minute(s) remaining`,
  });
</script>

<div class="deadline-info">
  <p>Deadline: {translations.deadlineDate}</p>
  <p class="time-remaining">
    {translations.minutesLeft(minutesRemaining)}
  </p>
</div>
```

### Relative Time Formatting

For "time ago" or "time until" formatting, use [Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat):

```typescript
// Custom method in your i18n provider
class ExtendedI18nProvider extends DefaultI18nProvider {
  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions
  ): string {
    const rtf = new Intl.RelativeTimeFormat(this.currentLocale, options);
    return rtf.format(value, unit);
  }
}

// Usage:
i18n.formatRelativeTime(-1, 'day');     // "1 day ago" (en-US)
i18n.formatRelativeTime(2, 'hour');     // "in 2 hours" (en-US)
i18n.formatRelativeTime(-3, 'month');   // "3 months ago" (en-US)
```

## Best Practices

### 1. Always Provide Fallbacks

```typescript
// ✅ Good - has fallback
const text = i18n?.plural?.('plurals.items', { count }) ??
  `${count} item(s)`;

// ❌ Bad - crashes if plural not available
const text = i18n.plural('plurals.items', { count });
```

### 2. Use $derived for Reactive Formatting

```typescript
// ✅ Good - reactive
const formattedDate = $derived(
  i18n?.formatDate?.(deadline) ?? deadline.toLocaleDateString()
);

// ❌ Bad - not reactive, won't update when locale changes
let formattedDate = i18n?.formatDate?.(deadline);
```

### 3. Cache Expensive Formatters

For frequently updated values, consider caching formatters:

```typescript
const numberFormatter = $derived(
  i18n ? new Intl.NumberFormat(i18n.getLocale(), {
    style: 'currency',
    currency: 'USD',
  }) : null
);

const formattedPrice = $derived(
  numberFormatter?.format(price) ?? `$${price}`
);
```

### 4. Use Appropriate Precision

```typescript
// ✅ Good - appropriate precision for percentages
i18n?.formatNumber?.(0.856, {
  style: 'percent',
  maximumFractionDigits: 1,
});
// "85.6%"

// ❌ Bad - too much precision
i18n?.formatNumber?.(0.856, { style: 'percent' });
// "85.6000000000000014%"
```

### 5. Consider Timezone for Dates

```typescript
// Display in user's timezone
i18n?.formatDate?.(date, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

// Or specify explicit timezone
i18n?.formatDate?.(date, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/New_York',
});
```

### 6. Test with Multiple Locales

Always test formatting with different locales to catch issues:

```typescript
// Test with various locales
const testLocales = ['en-US', 'fr-FR', 'de-DE', 'ja-JP', 'ar-SA'];

testLocales.forEach(locale => {
  const i18n = createSvelteI18nProvider(locale);
  console.log(locale, i18n.formatNumber(1234.56, {
    style: 'currency',
    currency: 'USD',
  }));
});

// Output:
// en-US: $1,234.56
// fr-FR: 1 234,56 $US
// de-DE: 1.234,56 $
// ja-JP: $1,234.56
// ar-SA: US$ ١٬٢٣٤٫٥٦
```

### 7. Document Custom Plural Forms

When adding custom plurals, document them clearly:

```typescript
// locales/en-US.ts

/**
 * Custom plural forms for the application
 *
 * Usage: i18n.plural('plurals.participants', { count: n })
 */
export default {
  plurals: {
    // Assessment-specific plurals
    participants: {
      one: '{count} participant',
      other: '{count} participants',
    },

    // Quiz-specific plurals
    quizzes: {
      one: '{count} quiz',
      other: '{count} quizzes',
    },
  },
};
```

## See Also

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Basic i18n integration
- [COMPONENT_PATTERNS.md](./COMPONENT_PATTERNS.md) - UI component patterns
- [MIGRATION.md](./MIGRATION.md) - Migrating existing components
- [MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [MDN: Intl.PluralRules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)
