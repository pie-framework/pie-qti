# I18n Integration Guide

**How to Integrate Internationalization in PIE-QTI Components**

This guide explains how to add and use i18n in your components.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Why i18n is Optional](#why-i18n-is-optional)
3. [Adding i18n to a Component](#adding-i18n-to-a-component)
4. [Using Reactive Translations](#using-reactive-translations)
5. [Adding New Message Keys](#adding-new-message-keys)
6. [Testing with Different Locales](#testing-with-different-locales)
7. [Common Pitfalls](#common-pitfalls)
8. [Best Practices](#best-practices)

---

## Quick Start

### For Component Authors

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/qti2-i18n';

interface Props {
  // ... other props
  i18n?: I18nProvider;  // ✅ Always optional
}

let { i18n, /* other props */ }: Props = $props();

// ✅ Use $derived for reactive translations
const translations = $derived({
  label: i18n?.t('component.label') ?? 'component.label',
  submit: i18n?.t('common.submit') ?? 'common.submit',
});
</script>

<button>{translations.submit}</button>
```

### For Component Users

```svelte
<script lang="ts">
import { SvelteI18nProvider } from '@pie-qti/qti2-i18n';
import MyComponent from './MyComponent.svelte';

const i18nProvider = new SvelteI18nProvider('en-US');
</script>

<MyComponent i18n={i18nProvider} />
```

---

## Why i18n is Optional

The i18n system is designed to be **optional but recommended**:

### When i18n is Provided

```typescript
// Framework handles locale fallback automatically:
// 1. Custom messages (if provided)
// 2. Current locale (e.g., es-ES)
// 3. en-US (always eagerly loaded)
// 4. Key itself (if still missing)

i18n.t('common.submit') // Returns: "Submit" (en-US default)
```

### When i18n is Missing

```typescript
// Component falls back to message key:
i18n?.t('common.submit') ?? 'common.submit' // Returns: "common.submit"
```

### Benefits of This Approach

1. **Development Visibility** - Missing i18n integration is immediately obvious (shows keys)
2. **Framework Flexibility** - Components work in any context (testing, web components, etc.)
3. **Graceful Degradation** - Apps work without i18n (with keys as labels)
4. **Type Safety** - Keys are searchable and refactorable

---

## Adding i18n to a Component

### Step 1: Add the i18n Prop

```typescript
import type { I18nProvider } from '@pie-qti/qti2-i18n';

interface Props {
  interaction: InteractionData;
  response: string | null;
  disabled?: boolean;
  i18n?: I18nProvider;  // ✅ Always optional
  onChange: (value: string | null) => void;
}

let {
  interaction,
  response,
  disabled = false,
  i18n,  // ✅ Destructure it
  onChange
}: Props = $props();
```

### Step 2: Create Reactive Translations

```typescript
// ✅ CORRECT - Use $derived for reactivity
const translations = $derived({
  label: i18n?.t('interactions.myComponent.label') ?? 'interactions.myComponent.label',
  instruction: i18n?.t('interactions.myComponent.instruction') ?? 'interactions.myComponent.instruction',
  submit: i18n?.t('common.submit') ?? 'common.submit',

  // For interpolation, use functions:
  itemSelected: (count: number) =>
    i18n?.t('interactions.myComponent.itemSelected', { count }) ??
    `interactions.myComponent.itemSelected (${count})`,
});
```

**Why $derived?**
- Translations reactively update when locale changes
- Computed once per locale change (efficient)
- Clean, declarative syntax

### Step 3: Use Translations in Template

```svelte
<div class="form-control">
  <label class="label">
    <span class="label-text">{translations.label}</span>
  </label>
  <input
    class="input input-bordered"
    placeholder={translations.instruction}
    aria-label={translations.label}
  />
</div>

<button class="btn btn-primary" onclick={handleSubmit}>
  {translations.submit}
</button>
```

### Step 4: Pass i18n to Child Components

```svelte
<script lang="ts">
import ChildComponent from './ChildComponent.svelte';

let { i18n }: { i18n?: I18nProvider } = $props();
</script>

<ChildComponent {i18n} />
```

---

## Using Reactive Translations

### Basic Usage

```typescript
// ✅ CORRECT - Reactive with $derived
const translations = $derived({
  title: i18n?.t('page.title') ?? 'page.title',
});

// ❌ INCORRECT - Won't update on locale change
const title = i18n?.t('page.title') ?? 'page.title';
```

### Interpolation

```typescript
const translations = $derived({
  // Simple interpolation
  greeting: (name: string) =>
    i18n?.t('common.greeting', { name }) ?? `common.greeting (${name})`,

  // Multiple values
  dateRange: (start: string, end: string) =>
    i18n?.t('common.dateRange', { start, end }) ??
    `common.dateRange (${start} - ${end})`,

  // Number formatting
  score: (points: number) =>
    i18n?.t('assessment.score', { points }) ??
    `assessment.score (${points})`,
});
```

Usage in template:

```svelte
<p>{translations.greeting('Alice')}</p>
<p>{translations.dateRange('2024-01-01', '2024-12-31')}</p>
<p>{translations.score(95)}</p>
```

### Conditional Translations

```typescript
const translations = $derived({
  status: disabled
    ? i18n?.t('common.disabled') ?? 'common.disabled'
    : i18n?.t('common.enabled') ?? 'common.enabled',
});
```

### Computed Translations

```typescript
const itemCount = $state(0);

const translations = $derived({
  // This automatically updates when itemCount changes
  summary: i18n?.t('interactions.itemCount', { count: itemCount }) ??
    `interactions.itemCount (${itemCount})`,
});
```

---

## Adding New Message Keys

### Step 1: Choose the Right Namespace

Message keys are organized by category:

```typescript
common.*              // Shared across all components
units.*               // Units of measurement
validation.*          // Validation messages
interactions.*        // Interaction-specific messages
item.*               // Item player messages
itemSession.*        // Item session messages
feedback.*           // Feedback messages
assessment.*         // Assessment player messages
accessibility.*      // Accessibility messages
```

### Step 2: Add to en-US Locale

Open `packages/qti2-i18n/src/locales/en-US.ts`:

```typescript
export default {
  // ... existing keys

  interactions: {
    // ... existing interactions

    myComponent: {
      label: 'Component Label',
      instruction: 'Enter your response',
      submit: 'Submit Response',
      clear: 'Clear Response',

      // For interpolation
      itemsSelected: '{count} items selected',

      // For aria-labels
      ariaLabel: 'Interactive component',
      ariaDescription: 'Use arrow keys to navigate',
    },
  },
};
```

### Step 3: Use in Component

```typescript
const translations = $derived({
  label: i18n?.t('interactions.myComponent.label') ?? 'interactions.myComponent.label',
  instruction: i18n?.t('interactions.myComponent.instruction') ?? 'interactions.myComponent.instruction',
});
```

### Step 4: TypeScript Autocomplete

TypeScript will automatically provide autocomplete for your new keys! The i18n package generates types from the en-US locale.

---

## Testing with Different Locales

### In Development

```svelte
<script lang="ts">
import { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

// Test with different locales
const i18nProvider = new SvelteI18nProvider('es-ES'); // Spanish
// const i18nProvider = new SvelteI18nProvider('fr-FR'); // French
// const i18nProvider = new SvelteI18nProvider('nl-NL'); // Dutch
</script>

<YourComponent i18n={i18nProvider} />
```

### Switching Locales

```svelte
<script lang="ts">
import { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

const i18nProvider = new SvelteI18nProvider('en-US');

async function switchLocale(locale: string) {
  await i18nProvider.setLocale(locale);
  // All components reactively update!
}
</script>

<select onchange={(e) => switchLocale(e.currentTarget.value)}>
  <option value="en-US">English</option>
  <option value="es-ES">Español</option>
  <option value="fr-FR">Français</option>
</select>

<YourComponent i18n={i18nProvider} />
```

### Without i18n (Testing)

```svelte
<!-- Component works without i18n - shows keys -->
<YourComponent />
```

---

## Common Pitfalls

### ❌ Using English String Fallbacks

```typescript
// ❌ WRONG - Hides missing i18n integration
const label = i18n?.t('component.label') ?? 'Label';

// ✅ CORRECT - Shows descriptive key if i18n missing
const label = i18n?.t('component.label') ?? 'component.label';
```

### ❌ Not Using $derived

```typescript
// ❌ WRONG - Won't update on locale change
const title = i18n?.t('page.title') ?? 'page.title';

// ✅ CORRECT - Reactive translation
const translations = $derived({
  title: i18n?.t('page.title') ?? 'page.title',
});
```

### ❌ Using Translations in $effect

```typescript
// ❌ WRONG - Effect recreates on every translation change
$effect(() => {
  const label = i18n?.t('component.label');
  // Do something
});

// ✅ CORRECT - Use untrack() if needed
import { untrack } from 'svelte';

$effect(() => {
  const label = untrack(() => i18n?.t('component.label'));
  // Effect won't rerun on locale change
});
```

### ❌ Forgetting Optional Chaining

```typescript
// ❌ WRONG - Crashes if i18n is undefined
const label = i18n.t('component.label');

// ✅ CORRECT - Safe with optional chaining
const label = i18n?.t('component.label') ?? 'component.label';
```

### ❌ Hardcoding Locale in Component

```typescript
// ❌ WRONG - Hardcoded locale
const label = i18n?.t('component.label', { locale: 'en-US' });

// ✅ CORRECT - Use current locale
const label = i18n?.t('component.label');
```

---

## Best Practices

### 1. Always Use Descriptive Keys

```typescript
// ✅ GOOD - Clear, hierarchical keys
'interactions.drawing.clearCanvas'
'assessment.navigation.nextItem'
'feedback.correctAnswer'

// ❌ BAD - Ambiguous keys
'clear'
'next'
'correct'
```

### 2. Group Related Keys

```typescript
export default {
  interactions: {
    drawing: {
      label: 'Drawing Canvas',
      clear: 'Clear',
      undo: 'Undo',
      redo: 'Redo',
      // All drawing-related keys together
    },
  },
};
```

### 3. Use Common Keys for Common Actions

```typescript
// ✅ GOOD - Reuse common keys
const translations = $derived({
  submit: i18n?.t('common.submit') ?? 'common.submit',
  cancel: i18n?.t('common.cancel') ?? 'common.cancel',
});

// ❌ BAD - Creating redundant keys
const translations = $derived({
  submit: i18n?.t('myComponent.submit') ?? 'myComponent.submit',
  cancel: i18n?.t('myComponent.cancel') ?? 'myComponent.cancel',
});
```

### 4. Provide Context in Aria Labels

```svelte
<button
  aria-label="{translations.item} {index + 1}. {translations.instructions}"
  onclick={handleClick}
>
  {translations.item} {index + 1}
</button>
```

### 5. Use Screen Reader Announcements

```svelte
<script lang="ts">
let announceText = $state('');

const translations = $derived({
  itemAdded: (item: string) =>
    i18n?.t('component.itemAdded', { item }) ??
    `component.itemAdded (${item})`,
});

function addItem(item: string) {
  // Add item logic
  announceText = translations.itemAdded(item);
}
</script>

<!-- Live region for screen readers -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {announceText}
</div>

<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

### 6. Handle Pluralization

```typescript
// In locale file
export default {
  interactions: {
    upload: {
      filesSelected: {
        one: '1 file selected',
        other: '{count} files selected',
      },
    },
  },
};

// In component
const translations = $derived({
  filesSelected: (count: number) =>
    i18n?.plural('interactions.upload.filesSelected', { count }) ??
    `${count} files selected`,
});
```

### 7. Format Numbers and Dates

```typescript
const translations = $derived({
  // Use built-in formatting
  score: (points: number) =>
    i18n?.formatNumber?.(points) ?? points.toString(),

  deadline: (date: Date) =>
    i18n?.formatDate?.(date, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }) ?? date.toLocaleString(),
});
```

---

## Complete Example

Here's a complete example showing all best practices:

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/qti2-i18n';

interface Props {
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  disabled?: boolean;
  i18n?: I18nProvider;
  onChange: (ids: string[]) => void;
}

let {
  items,
  selectedIds,
  disabled = false,
  i18n,
  onChange
}: Props = $props();

// Reactive translations
const translations = $derived({
  title: i18n?.t('component.selectionList.title') ?? 'component.selectionList.title',
  instruction: i18n?.t('component.selectionList.instruction') ?? 'component.selectionList.instruction',
  clearAll: i18n?.t('common.clearAll') ?? 'common.clearAll',

  // Functions for interpolation
  selected: (count: number) =>
    i18n?.t('component.selectionList.selected', { count }) ??
    `component.selectionList.selected (${count})`,

  itemAriaLabel: (label: string, isSelected: boolean) => {
    const status = isSelected
      ? i18n?.t('common.selected') ?? 'common.selected'
      : i18n?.t('common.available') ?? 'common.available';
    return `${label}. ${status}`;
  },
});

// Local state
let announceText = $state('');

// Handlers
function toggleSelection(id: string, label: string) {
  if (disabled) return;

  const isSelected = selectedIds.includes(id);
  const newIds = isSelected
    ? selectedIds.filter(existingId => existingId !== id)
    : [...selectedIds, id];

  onChange(newIds);

  // Announce to screen readers
  const action = isSelected
    ? i18n?.t('common.deselected', { item: label }) ?? `common.deselected (${label})`
    : i18n?.t('common.selected', { item: label }) ?? `common.selected (${label})`;
  announceText = action;
}

function clearAll() {
  if (disabled) return;
  onChange([]);
  announceText = i18n?.t('component.selectionList.allCleared') ?? 'component.selectionList.allCleared';
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {announceText}
</div>

<div class="space-y-4">
  <div class="flex justify-between items-center">
    <h3 class="font-bold">{translations.title}</h3>
    <button
      class="btn btn-sm btn-outline"
      onclick={clearAll}
      disabled={disabled || selectedIds.length === 0}
    >
      {translations.clearAll}
    </button>
  </div>

  <p class="text-sm text-base-content/70">
    {translations.instruction}
  </p>

  <div class="text-sm font-semibold">
    {translations.selected(selectedIds.length)}
  </div>

  <div class="space-y-2">
    {#each items as item}
      {@const isSelected = selectedIds.includes(item.id)}
      <div class="form-control">
        <label class="label cursor-pointer justify-start gap-4">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            checked={isSelected}
            onchange={() => toggleSelection(item.id, item.label)}
            disabled={disabled}
            aria-label={translations.itemAriaLabel(item.label, isSelected)}
          />
          <span class="label-text">{item.label}</span>
        </label>
      </div>
    {/each}
  </div>
</div>

<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

---

## Related Documentation

- [COMPONENT_PATTERNS.md](./COMPONENT_PATTERNS.md) - Svelte 5 + DaisyUI + i18n patterns
- [I18N_IMPLEMENTATION_PLAN.md](../../../I18N_IMPLEMENTATION_PLAN.md) - Complete implementation plan
- [I18N_PROGRESS_SUMMARY.md](../../../I18N_PROGRESS_SUMMARY.md) - Current progress

---

## Need Help?

- Check existing components for examples: [NavigationBar.svelte](../../qti2-assessment-player/src/components/NavigationBar.svelte)
- Review the [en-US locale file](../src/locales/en-US.ts) for available keys
- See [COMPONENT_PATTERNS.md](./COMPONENT_PATTERNS.md) for more patterns
