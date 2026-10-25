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
8. [Component UI Patterns](#component-ui-patterns)
9. [Best Practices](#best-practices)

---

## Quick Start

### For Component Authors

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/i18n';

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
import { createDefaultSvelteI18nProvider } from '@pie-qti/i18n';
import MyComponent from './MyComponent.svelte';

const i18nProvider = await createDefaultSvelteI18nProvider('en-US');
</script>

<MyComponent i18n={i18nProvider} />
```

---

## Why i18n is Optional

The i18n system is designed to be **optional but recommended**:

### When i18n is Provided

```typescript
// Framework handles locale fallback automatically. Each step walks the tag's
// lookup sequence (es-MX, then es), custom messages before framework catalogs:
// 1. Current locale (e.g., es-MX → the es catalog)
// 2. English (en, always eagerly loaded)
// 3. Key itself (if still missing)

i18n.t('common.submit') // Returns: "Submit" (English default)
```

### When i18n is Missing

```typescript
// Component falls back to message key:
i18n?.t('common.submit') ?? 'common.submit' // Returns: "common.submit"
```

The item and assessment players never leave their components without a provider: when the host
passes none, they render with an English `DefaultI18nProvider`.

### Benefits of This Approach

1. **Development Visibility** - Missing i18n integration is immediately obvious (shows keys)
2. **Framework Flexibility** - Components work in any context (testing, web components, etc.)
3. **Graceful Degradation** - Apps work without i18n (with keys as labels)
4. **Type Safety** - Keys are searchable and refactorable

---

## Adding i18n to a Component

### Step 1: Add the i18n Prop

```typescript
import type { I18nProvider } from '@pie-qti/i18n';

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
- Keeps translation lookups declarative and tied to the component's inputs
- Re-evaluates whenever the `i18n` prop or interpolation values change
- A component re-renders when the host passes a new provider or `withLocale()` view; a host that switches locale in place with `SvelteI18nProvider.setLocale()` opts into `reloadOnLocaleChange` so every component renders with the active locale

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
// ✅ CORRECT - Derived translation
const translations = $derived({
  title: i18n?.t('page.title') ?? 'page.title',
});

// ❌ INCORRECT - Translation captured once as a plain constant
const title = i18n?.t('page.title') ?? 'page.title';
```

**Note:** `SvelteI18nProvider.setLocale()` persists the locale and reloads the page only when the host
opts in (`persistLocale`, `reloadOnLocaleChange`). `$derived` matters either way for values that
change within a component's lifetime (props, state, interpolated values).

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

### Step 2: Add to the English Catalog

Open `packages/i18n/src/locales/en.ts`:

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

TypeScript will automatically provide autocomplete for your new keys! The i18n package generates types from the English catalog.

---

## Testing with Different Locales

### In Development

```svelte
<script lang="ts">
import { createDefaultSvelteI18nProvider } from '@pie-qti/i18n';

// Test with different locales
const i18nProvider = await createDefaultSvelteI18nProvider('es-ES'); // Spanish
// const i18nProvider = await createDefaultSvelteI18nProvider('fr-FR'); // French
// const i18nProvider = await createDefaultSvelteI18nProvider('nl-NL'); // Dutch
</script>

<YourComponent i18n={i18nProvider} />
```

### Switching Locales

```svelte
<script lang="ts">
import { createDefaultSvelteI18nProvider, DEFAULT_LOCALE_STORAGE_KEY } from '@pie-qti/i18n';

// The host owns the locale: it reads its stored value and opts into persistence
// and reload. The provider never reads storage.
const saved = localStorage.getItem(DEFAULT_LOCALE_STORAGE_KEY) ?? 'en-US';
const i18nProvider = await createDefaultSvelteI18nProvider(saved, undefined, {
  persistLocale: true,
  reloadOnLocaleChange: true,
});

async function switchLocale(locale: string) {
  await i18nProvider.setLocale(locale);
  // Writes the locale to localStorage and reloads the page, so every
  // component renders with the new locale after the reload.
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
// ❌ WRONG - Translation captured once as a plain constant
const title = i18n?.t('page.title') ?? 'page.title';

// ✅ CORRECT - Derived translation
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

## Component UI Patterns

The examples above use [DaisyUI](https://daisyui.com/) semantic utility classes. The patterns in this section are the conventions used across PIE-QTI components.

### DaisyUI Semantic Classes

Use DaisyUI's semantic utility classes consistently:

```svelte
<!-- Buttons -->
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-outline">Secondary Action</button>
<button class="btn btn-error">Destructive Action</button>

<!-- Forms -->
<div class="form-control">
  <label class="label">
    <span class="label-text">Field Label</span>
  </label>
  <input class="input input-bordered" />
</div>

<!-- Alerts -->
<div class="alert alert-error">Error message</div>
<div class="alert alert-warning">Warning message</div>
<div class="alert alert-info">Info message</div>
```

### Loading, Skeleton, and Progress States

```svelte
<!-- Spinner -->
<div class="flex justify-center items-center py-8">
  <span class="loading loading-spinner loading-lg"></span>
</div>

<!-- Spinner with a translated message -->
<div class="flex flex-col justify-center items-center gap-4 py-8">
  <span class="loading loading-spinner loading-lg"></span>
  <p class="text-sm text-base-content/70">{translations.loading}</p>
</div>

<!-- Skeleton placeholders -->
<div class="space-y-4">
  <div class="skeleton h-4 w-full"></div>
  <div class="skeleton h-4 w-3/4"></div>
  <div class="skeleton h-32 w-full"></div>
</div>

<!-- Progress bar -->
<progress class="progress progress-primary w-full" value={progress} max="100"></progress>
```

### Alerts

```svelte
<!-- Error alert -->
<div class="alert alert-error">
  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>{errorMessage}</span>
</div>

<!-- Dismissible info alert -->
{#if visible}
  <div class="alert alert-info">
    <span>{message}</span>
    <button
      class="btn btn-sm btn-circle btn-ghost"
      onclick={() => visible = false}
      aria-label={translations.close}
    >
      ✕
    </button>
  </div>
{/if}
```

### Drag and Drop with `touchDrag`

Interactive components that drag use the `touchDrag` action from `@pie-qti/qti-common` so drag
works on touch devices, not only with a mouse:

```svelte
<script lang="ts">
  import { touchDrag } from '@pie-qti/qti-common';

  let draggedItem = $state<string | null>(null);
  let hoveredZone = $state<string | null>(null);

  const translations = $derived({
    dragInstruction: i18n?.t('interactions.component.dragInstruction') ?? 'interactions.component.dragInstruction',
    dropZone: i18n?.t('interactions.component.dropZone') ?? 'interactions.component.dropZone',
  });

  function handleDragStart(itemId: string) {
    if (disabled) return;
    draggedItem = itemId;
  }

  function handleDragEnd() {
    draggedItem = null;
    hoveredZone = null;
  }

  function handleDrop(event: DragEvent, zoneId: string) {
    if (disabled || !draggedItem) return;
    event.preventDefault();

    onChange({ item: draggedItem, zone: zoneId });

    draggedItem = null;
    hoveredZone = null;
  }
</script>

<!-- Draggable item -->
<button
  type="button"
  draggable={!disabled}
  use:touchDrag
  ondragstart={() => handleDragStart(item.id)}
  ondragend={handleDragEnd}
  class="btn btn-primary"
  class:opacity-50={draggedItem === item.id}
  aria-label="{item.label}. {translations.dragInstruction}"
>
  {item.label}
</button>

<!-- Drop zone -->
<div
  ondragover={(e) => { e.preventDefault(); hoveredZone = zone.id; }}
  ondragleave={() => hoveredZone = null}
  ondrop={(e) => handleDrop(e, zone.id)}
  class="border-2 border-dashed rounded-lg p-4"
  class:border-primary={hoveredZone === zone.id}
  role="button"
  tabindex="0"
  aria-label={translations.dropZone}
>
  {#if hoveredZone === zone.id}
    <div class="text-primary">{translations.dropHere}</div>
  {:else}
    {zone.label}
  {/if}
</div>
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
import type { I18nProvider } from '@pie-qti/i18n';

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

## Need Help?

- Check existing components for examples: [NavigationBar.svelte](../../assessment-player/src/components/NavigationBar.svelte)
- Review the [English catalog](../src/locales/en.ts) for available keys
