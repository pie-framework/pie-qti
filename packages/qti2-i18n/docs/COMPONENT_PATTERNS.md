# Component Patterns Guide

**PIE-QTI I18n Component Patterns**

This guide provides standardized patterns for building components with Svelte 5, DaisyUI, and i18n integration.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Basic Component Structure](#basic-component-structure)
3. [Button Patterns](#button-patterns)
4. [Form Patterns](#form-patterns)
5. [Modal Patterns](#modal-patterns)
6. [Alert Patterns](#alert-patterns)
7. [Loading State Patterns](#loading-state-patterns)
8. [Interaction Component Patterns](#interaction-component-patterns)
9. [Best Practices](#best-practices)

---

## Core Principles

### 1. Svelte 5 Runes

Always use modern Svelte 5 patterns:

```typescript
// ✅ CORRECT - Use $props() for component props
let { interaction, response, disabled, i18n }: Props = $props();

// ✅ CORRECT - Use $state() for reactive state
let isOpen = $state(false);
let selectedItem = $state<string | null>(null);

// ✅ CORRECT - Use $derived() for computed values
const isValid = $derived(response !== null && response.length > 0);
const currentValue = $derived(parsedResponse ?? defaultValue);

// ✅ CORRECT - Use $effect() for side effects with cleanup
$effect(() => {
  const unsubscribe = subscribe();
  return () => unsubscribe(); // Cleanup
});

// ❌ INCORRECT - Don't use onMount/onDestroy
// ❌ INCORRECT - Don't use $ reactive declarations
```

### 2. Optional i18n with Key Fallbacks

```typescript
import type { I18nProvider } from '@pie-qti/qti2-i18n';

// ✅ CORRECT - i18n is optional
let { i18n }: { i18n?: I18nProvider } = $props();

// ✅ CORRECT - Reactive translations with key fallbacks
const translations = $derived({
  label: i18n?.t('component.label') ?? 'component.label',
  help: i18n?.t('component.help') ?? 'component.help',
});

// ❌ INCORRECT - Never use English string fallbacks
// const label = i18n?.t('component.label') ?? 'Label';
```

### 3. DaisyUI Semantic Classes

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

---

## Basic Component Structure

### Standard Interaction Component

```svelte
<script lang="ts">
import type { I18nProvider } from '@pie-qti/qti2-i18n';

interface Props {
  interaction: InteractionData;
  response: string | null;
  disabled?: boolean;
  i18n?: I18nProvider;
  onChange: (value: string | null) => void;
}

let {
  interaction,
  response,
  disabled = false,
  i18n,
  onChange
}: Props = $props();

// Reactive translations
const translations = $derived({
  label: i18n?.t('interactions.myComponent.label') ?? 'interactions.myComponent.label',
  instruction: i18n?.t('interactions.myComponent.instruction') ?? 'interactions.myComponent.instruction',
  submit: i18n?.t('common.submit') ?? 'common.submit',
  clear: i18n?.t('common.clear') ?? 'common.clear',
});

// Local state
let internalValue = $state<string | null>(null);

// Derived values
const isValid = $derived(internalValue !== null && internalValue.length > 0);

// Effects
$effect(() => {
  internalValue = response;
});

// Event handlers
function handleChange(value: string) {
  internalValue = value;
  onChange(value);
}

function handleClear() {
  internalValue = null;
  onChange(null);
}
</script>

<div class="space-y-4">
  {#if interaction.prompt}
    <p class="font-semibold">{@html interaction.prompt}</p>
  {/if}

  <div class="form-control">
    <label class="label">
      <span class="label-text">{translations.label}</span>
    </label>
    <input
      class="input input-bordered"
      class:input-error={!isValid}
      value={internalValue ?? ''}
      oninput={(e) => handleChange(e.currentTarget.value)}
      disabled={disabled}
      placeholder={translations.instruction}
    />
  </div>

  <div class="flex gap-2">
    <button
      class="btn btn-primary"
      onclick={handleSubmit}
      disabled={!isValid || disabled}
    >
      {translations.submit}
    </button>
    <button
      class="btn btn-outline"
      onclick={handleClear}
      disabled={!internalValue || disabled}
    >
      {translations.clear}
    </button>
  </div>
</div>
```

---

## Button Patterns

### Primary Action Button

```svelte
<script lang="ts">
const translations = $derived({
  submit: i18n?.t('common.submit') ?? 'common.submit',
});
</script>

<button
  class="btn btn-primary"
  onclick={handleSubmit}
  disabled={!canSubmit}
>
  {translations.submit}
</button>
```

### Secondary Action Button

```svelte
<button
  class="btn btn-outline"
  onclick={handleCancel}
>
  {translations.cancel}
</button>
```

### Destructive Action Button

```svelte
<button
  class="btn btn-error"
  onclick={handleDelete}
>
  {translations.delete}
</button>
```

### Button with Loading State

```svelte
<script lang="ts">
let isLoading = $state(false);

const translations = $derived({
  submit: i18n?.t('common.submit') ?? 'common.submit',
  loading: i18n?.t('common.loading') ?? 'common.loading',
});

async function handleSubmit() {
  isLoading = true;
  try {
    await submitData();
  } finally {
    isLoading = false;
  }
}
</script>

<button
  class="btn btn-primary"
  onclick={handleSubmit}
  disabled={isLoading}
>
  {#if isLoading}
    <span class="loading loading-spinner loading-sm"></span>
  {/if}
  {isLoading ? translations.loading : translations.submit}
</button>
```

### Icon Button

```svelte
<button
  class="btn btn-sm btn-circle btn-error"
  onclick={handleRemove}
  aria-label={translations.remove}
  title={translations.remove}
>
  ✕
</button>
```

---

## Form Patterns

### Text Input

```svelte
<div class="form-control">
  <label class="label" for={inputId}>
    <span class="label-text font-semibold">{translations.label}</span>
    {#if required}
      <span class="label-text-alt text-error">*</span>
    {/if}
  </label>
  <input
    id={inputId}
    type="text"
    class="input input-bordered"
    class:input-error={error}
    value={value}
    oninput={(e) => onChange(e.currentTarget.value)}
    placeholder={translations.placeholder}
    disabled={disabled}
    required={required}
  />
  {#if error}
    <label class="label">
      <span class="label-text-alt text-error">{error}</span>
    </label>
  {/if}
</div>
```

### Textarea

```svelte
<div class="form-control">
  <label class="label" for={textareaId}>
    <span class="label-text font-semibold">{translations.label}</span>
  </label>
  <textarea
    id={textareaId}
    class="textarea textarea-bordered"
    class:textarea-error={error}
    rows="4"
    value={value}
    oninput={(e) => onChange(e.currentTarget.value)}
    placeholder={translations.placeholder}
    disabled={disabled}
  ></textarea>
</div>
```

### Select Dropdown

```svelte
<div class="form-control">
  <label class="label" for={selectId}>
    <span class="label-text font-semibold">{translations.label}</span>
  </label>
  <select
    id={selectId}
    class="select select-bordered"
    value={value}
    onchange={(e) => onChange(e.currentTarget.value)}
    disabled={disabled}
  >
    <option value="" disabled>{translations.selectPlaceholder}</option>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</div>
```

### Checkbox

```svelte
<div class="form-control">
  <label class="label cursor-pointer justify-start gap-4">
    <input
      type="checkbox"
      class="checkbox checkbox-primary"
      checked={checked}
      onchange={(e) => onChange(e.currentTarget.checked)}
      disabled={disabled}
    />
    <span class="label-text">{translations.label}</span>
  </label>
</div>
```

### Radio Button Group

```svelte
<div class="space-y-2">
  <div class="font-semibold text-sm">{translations.groupLabel}</div>
  {#each options as option}
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-4">
        <input
          type="radio"
          name={groupName}
          class="radio radio-primary"
          value={option.value}
          checked={value === option.value}
          onchange={() => onChange(option.value)}
          disabled={disabled}
        />
        <span class="label-text">{option.label}</span>
      </label>
    </div>
  {/each}
</div>
```

### Form Validation Display

```svelte
<div class="form-control">
  <label class="label" for={inputId}>
    <span class="label-text font-semibold">{label}</span>
  </label>
  <input
    id={inputId}
    class="input input-bordered"
    class:input-error={error}
    value={value}
    oninput={(e) => handleInput(e.currentTarget.value)}
  />
  {#if error}
    <div class="alert alert-error py-2 mt-2">
      <span class="text-sm">{error}</span>
    </div>
  {/if}
  {#if hint && !error}
    <label class="label">
      <span class="label-text-alt">{hint}</span>
    </label>
  {/if}
</div>
```

---

## Modal Patterns

### Basic Modal

```svelte
<script lang="ts">
let isOpen = $state(false);

const translations = $derived({
  title: i18n?.t('modal.title') ?? 'modal.title',
  content: i18n?.t('modal.content') ?? 'modal.content',
  confirm: i18n?.t('common.confirm') ?? 'common.confirm',
  cancel: i18n?.t('common.cancel') ?? 'common.cancel',
});

function open() {
  isOpen = true;
}

function close() {
  isOpen = false;
}

function handleConfirm() {
  // Do something
  close();
}
</script>

<button class="btn btn-primary" onclick={open}>
  Open Modal
</button>

{#if isOpen}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{translations.title}</h3>
      <p class="py-4">{translations.content}</p>
      <div class="modal-action">
        <button class="btn" onclick={close}>
          {translations.cancel}
        </button>
        <button class="btn btn-primary" onclick={handleConfirm}>
          {translations.confirm}
        </button>
      </div>
    </div>
    <div class="modal-backdrop" onclick={close}></div>
  </div>
{/if}
```

### Modal with Close Button

```svelte
<div class="modal modal-open">
  <div class="modal-box">
    <button
      class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
      onclick={close}
      aria-label={translations.close}
    >
      ✕
    </button>
    <h3 class="font-bold text-lg">{translations.title}</h3>
    <p class="py-4">{translations.content}</p>
    <div class="modal-action">
      <button class="btn btn-primary" onclick={handleConfirm}>
        {translations.confirm}
      </button>
    </div>
  </div>
</div>
```

---

## Alert Patterns

### Error Alert

```svelte
<div class="alert alert-error">
  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>{errorMessage}</span>
</div>
```

### Warning Alert

```svelte
<div class="alert alert-warning">
  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
  <span>{warningMessage}</span>
</div>
```

### Info Alert

```svelte
<div class="alert alert-info">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
  <span>{infoMessage}</span>
</div>
```

### Success Alert

```svelte
<div class="alert alert-success">
  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>{successMessage}</span>
</div>
```

### Dismissible Alert

```svelte
<script lang="ts">
let visible = $state(true);
</script>

{#if visible}
  <div class="alert alert-info">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
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

---

## Loading State Patterns

### Loading Spinner

```svelte
<div class="flex justify-center items-center py-8">
  <span class="loading loading-spinner loading-lg"></span>
</div>
```

### Loading with Message

```svelte
<div class="flex flex-col justify-center items-center gap-4 py-8">
  <span class="loading loading-spinner loading-lg"></span>
  <p class="text-sm text-base-content/70">{translations.loading}</p>
</div>
```

### Skeleton Loading

```svelte
<div class="space-y-4">
  <div class="skeleton h-4 w-full"></div>
  <div class="skeleton h-4 w-3/4"></div>
  <div class="skeleton h-32 w-full"></div>
</div>
```

### Progress Bar

```svelte
<progress
  class="progress progress-primary w-full"
  value={progress}
  max="100"
></progress>
```

---

## Interaction Component Patterns

### Drag and Drop Component

```svelte
<script lang="ts">
import { touchDrag } from '../utils/touchDragHelper.js';

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

  // Process drop
  onChange({ item: draggedItem, zone: zoneId });

  draggedItem = null;
  hoveredZone = null;
}
</script>

<!-- Draggable items -->
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

### Keyboard-Accessible Selection

```svelte
<script lang="ts">
let selectedId = $state<string | null>(null);
let announceText = $state<string>('');

const translations = $derived({
  selected: (item: string) => i18n?.t('common.selected', { item }) ?? `common.selected (${item})`,
  deselected: (item: string) => i18n?.t('common.deselected', { item }) ?? `common.deselected (${item})`,
});

function handleKeyDown(event: KeyboardEvent, itemId: string) {
  if (disabled) return;

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();

    if (selectedId === itemId) {
      selectedId = null;
      announceText = translations.deselected(itemLabel);
    } else {
      selectedId = itemId;
      announceText = translations.selected(itemLabel);
    }
  }

  if (event.key === 'Escape' && selectedId) {
    event.preventDefault();
    selectedId = null;
    announceText = i18n?.t('common.selectionCancelled') ?? 'common.selectionCancelled';
  }
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {announceText}
</div>

<!-- Selectable item -->
<button
  type="button"
  onkeydown={(e) => handleKeyDown(e, item.id)}
  onclick={() => handleSelection(item.id)}
  aria-pressed={selectedId === item.id}
  class="btn"
  class:btn-accent={selectedId === item.id}
  class:btn-outline={selectedId !== item.id}
>
  {item.label}
</button>

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

## Best Practices

### 1. Always Use Reactive Translations

```typescript
// ✅ CORRECT - Reactive translations update when locale changes
const translations = $derived({
  label: i18n?.t('key') ?? 'key',
});

// ❌ INCORRECT - Won't update on locale change
const label = i18n?.t('key') ?? 'key';
```

### 2. Provide Descriptive Aria Labels

```svelte
<!-- ✅ CORRECT - Full context for screen readers -->
<button
  aria-label="{item.label}. {translations.dragInstruction}. {translations.status}"
>
  {item.label}
</button>

<!-- ❌ INCORRECT - Missing context -->
<button aria-label={item.label}>
  {item.label}
</button>
```

### 3. Use SVG aria-hidden for Decorative Icons

```svelte
<!-- ✅ CORRECT - Decorative icon hidden from screen readers -->
<svg aria-hidden="true" class="w-6 h-6">...</svg>

<!-- ❌ INCORRECT - Screen reader will try to read the SVG -->
<svg class="w-6 h-6">...</svg>
```

### 4. Provide Screen Reader Announcements

```svelte
<script lang="ts">
let announceText = $state<string>('');

function handleAction() {
  // Perform action
  announceText = translations.actionCompleted;
}
</script>

<!-- Live region for announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {announceText}
</div>
```

### 5. Use Semantic HTML

```svelte
<!-- ✅ CORRECT - Semantic button -->
<button type="button" onclick={handleClick}>
  {label}
</button>

<!-- ❌ INCORRECT - div with click handler -->
<div onclick={handleClick}>
  {label}
</div>
```

### 6. Handle Loading and Error States

```svelte
<script lang="ts">
let isLoading = $state(false);
let error = $state<string | null>(null);
let data = $state<Data | null>(null);

$effect(() => {
  loadData();
});

async function loadData() {
  isLoading = true;
  error = null;

  try {
    data = await fetchData();
  } catch (e) {
    error = translations.loadError;
  } finally {
    isLoading = false;
  }
}
</script>

{#if isLoading}
  <div class="flex justify-center py-8">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{:else if error}
  <div class="alert alert-error">
    <span>{error}</span>
  </div>
{:else if data}
  <!-- Render data -->
{/if}
```

### 7. Consistent Spacing

```svelte
<!-- Use consistent spacing utilities -->
<div class="space-y-4">  <!-- Vertical spacing -->
  <div class="flex gap-2"> <!-- Horizontal spacing -->
    <button class="btn">Button 1</button>
    <button class="btn">Button 2</button>
  </div>

  <div class="grid gap-4"> <!-- Grid spacing -->
    <div>Item 1</div>
    <div>Item 2</div>
  </div>
</div>
```

---

## Summary

- **Always use Svelte 5 runes** (`$props`, `$state`, `$derived`, `$effect`)
- **i18n is optional** with key fallbacks (never English strings)
- **Use DaisyUI semantic classes** for consistent styling
- **Provide full accessibility** (aria-labels, keyboard navigation, screen reader support)
- **Handle all states** (loading, error, empty, success)
- **Use reactive translations** with `$derived`
- **Follow semantic HTML** best practices

For more information, see:
- [I18N_IMPLEMENTATION_PLAN.md](../../../I18N_IMPLEMENTATION_PLAN.md)
- [I18N_PROGRESS_SUMMARY.md](../../../I18N_PROGRESS_SUMMARY.md)
