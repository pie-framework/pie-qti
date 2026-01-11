# Example Components

This directory contains example/reference components demonstrating i18n patterns in PIE-QTI.

## LocaleSwitcher

A reference implementation of a locale switcher component. You can use this directly or copy and customize it for your needs.

### Features

- Dropdown selector for changing display language
- Internationalized labels and aria-labels
- Compact mode (dropdown only, no label)
- Customizable available locales
- Keyboard accessible
- Supports DaisyUI theming

### Basic Usage

```svelte
<script>
  import { LocaleSwitcher, createSvelteI18nProvider } from '@pie-qti/qti2-i18n';

  let locale = $state('en-US');
  const i18nProvider = $derived(createSvelteI18nProvider(locale));

  function handleLocaleChange(newLocale) {
    locale = newLocale;
  }
</script>

<LocaleSwitcher
  currentLocale={locale}
  onChange={handleLocaleChange}
  i18n={i18nProvider}
/>
```

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `currentLocale` | `string` | Yes | - | Currently selected locale code (e.g., 'en-US') |
| `onChange` | `(locale: string) => void` | Yes | - | Callback when locale changes |
| `i18n` | `I18nProvider` | No | undefined | I18n provider for translating component UI |
| `availableLocales` | `Array<{code: string, label: string}>` | No | See below | List of locales to show in dropdown |
| `label` | `string` | No | Translated 'Language' | Override label text |
| `compact` | `boolean` | No | `false` | Hide label, show only dropdown |

### Default Available Locales

By default, LocaleSwitcher shows the locales that have translations in PIE-QTI:

- `en-US` - English (US)
- `es-ES` - Español
- `fr-FR` - Français
- `nl-NL` - Nederlands
- `ro-RO` - Română
- `th-TH` - ไทย

### Customizing Available Locales

You can provide your own list of locales:

```svelte
<script>
  const myLocales = [
    { code: 'en-US', label: 'English' },
    { code: 'es-ES', label: 'Spanish' },
    { code: 'fr-FR', label: 'French' },
  ];
</script>

<LocaleSwitcher
  currentLocale={locale}
  onChange={handleLocaleChange}
  availableLocales={myLocales}
/>
```

### Compact Mode

Use compact mode when you want the dropdown without a label (e.g., in a toolbar):

```svelte
<LocaleSwitcher
  currentLocale={locale}
  onChange={handleLocaleChange}
  i18n={i18nProvider}
  compact={true}
/>
```

### Custom Label

Override the default "Language" label:

```svelte
<LocaleSwitcher
  currentLocale={locale}
  onChange={handleLocaleChange}
  label="Choose Language"
/>
```

### Complete Example with Assessment Player

```svelte
<script lang="ts">
  import { AssessmentShell } from '@pie-qti/qti2-assessment-player';
  import { LocaleSwitcher, createSvelteI18nProvider } from '@pie-qti/qti2-i18n';

  interface Props {
    assessmentData: AssessmentData;
  }

  let { assessmentData }: Props = $props();

  // Locale state
  let locale = $state('en-US');
  const i18nProvider = $derived(createSvelteI18nProvider(locale));

  function handleLocaleChange(newLocale: string) {
    locale = newLocale;
    // Optionally save to localStorage
    localStorage.setItem('preferredLocale', newLocale);
  }

  // Restore saved locale on mount
  $effect(() => {
    const saved = localStorage.getItem('preferredLocale');
    if (saved) {
      locale = saved;
    }
  });
</script>

<div class="app-header">
  <h1>My Assessment</h1>
  <LocaleSwitcher
    currentLocale={locale}
    onChange={handleLocaleChange}
    i18n={i18nProvider}
    compact={true}
  />
</div>

<AssessmentShell
  assessment={assessmentData}
  i18n={i18nProvider}
/>

<style>
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e5e5;
  }
</style>
```

### Styling

The component uses CSS custom properties for theming:

```css
/* Override colors */
:root {
  --color-base-100: #ffffff;      /* Background */
  --color-base-200: #f5f5f5;      /* Alt background */
  --color-base-300: #e5e5e5;      /* Border */
  --color-base-content: #000000;  /* Text */
  --color-primary: #3b82f6;       /* Primary accent */
}

/* Dark mode */
[data-theme='dark'] {
  --color-base-100: #1f2937;
  --color-base-200: #111827;
  --color-base-300: #374151;
  --color-base-content: #f9fafb;
  --color-primary: #60a5fa;
}
```

Or use the `part` attribute for Shadow DOM styling:

```css
/* Style the select element */
pie-locale-switcher::part(select) {
  border-radius: 8px;
  font-size: 16px;
}
```

### Accessibility

The component follows WCAG 2.2 Level AA guidelines:

- Properly labeled with `<label for="...">` association
- Includes `aria-label` on the select for screen readers
- Keyboard navigable (arrow keys, Enter to select)
- Focus visible with outline
- Sufficient color contrast (>4.5:1)

### Copying and Customizing

This is a reference implementation - feel free to copy and modify:

1. Copy [LocaleSwitcher.svelte](./LocaleSwitcher.svelte) to your project
2. Customize the styling, props, or behavior
3. Add features like:
   - Flag icons for each locale
   - Search/filter for many locales
   - Automatic locale detection from browser
   - Two-letter language codes display

### Related Documentation

- [INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md) - How to add i18n to components
- [COMPONENT_PATTERNS.md](../../docs/COMPONENT_PATTERNS.md) - UI patterns and examples
- [MIGRATION.md](../../docs/MIGRATION.md) - Migrating existing components to i18n
