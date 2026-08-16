<!--
  LocaleSwitcher Example Component

  A reference implementation to copy into your own app. The package publishes no
  compiled Svelte, so there is no `@pie-qti/i18n/components` entry point to import
  from — copy this file and adapt it. `bun run check` in this package type-checks
  it so the reference stays valid.

  Usage:

  <script lang="ts">
    import LocaleSwitcher from './LocaleSwitcher.svelte';
    import { createDefaultSvelteI18nProvider, type SvelteI18nProvider } from '@pie-qti/i18n';

    let i18n = $state<SvelteI18nProvider | null>(null);

    $effect(() => {
      // Reads the persisted locale from localStorage and loads its catalog
      createDefaultSvelteI18nProvider().then((provider) => (i18n = provider));
    });
  </script>

  {#if i18n}
    <LocaleSwitcher
      currentLocale={i18n.getLocale()}
      onChange={(locale) => i18n?.setLocale(locale)}
      {i18n}
    />
  {/if}

  Note: SvelteI18nProvider.setLocale() persists the locale and then reloads the
  page, so this component does not need to propagate the change itself.
-->

<script lang="ts">
	import type { I18nProvider } from '../core/I18nProvider.js';

	interface Props {
		/** Currently selected locale code */
		currentLocale: string;
		/** Callback when locale changes */
		onChange: (locale: string) => void;
		/** I18n provider for translating the component UI (optional) */
		i18n?: I18nProvider;
		/** Supported locales (defaults to all available locales) */
		availableLocales?: Array<{ code: string; label: string }>;
		/** Label text (can be overridden) */
		label?: string;
		/** Compact mode - no label, just dropdown */
		compact?: boolean;
	}

	// Declared before $props(): a `const` referenced by a prop default must already
	// be initialised when the default is evaluated, or omitting the prop throws a
	// temporal-dead-zone ReferenceError.
	// ar-SA is deliberately absent until the package can expose text direction.
	const DEFAULT_LOCALES = [
		{ code: 'en-US', label: 'English (US)' },
		{ code: 'es-ES', label: 'Español' },
		{ code: 'fr-FR', label: 'Français' },
		{ code: 'nl-NL', label: 'Nederlands' },
		{ code: 'ro-RO', label: 'Română' },
		{ code: 'th-TH', label: 'ไทย' },
		{ code: 'zh-CN', label: '中文（简体）' },
	];

	let {
		currentLocale,
		onChange,
		i18n,
		availableLocales = DEFAULT_LOCALES,
		label,
		compact = false,
	}: Props = $props();

	// Reactive translations
	const translations = $derived({
		selectLanguage: label ?? i18n?.t('i18n.selectLanguage') ?? 'Language',
		ariaLabel: i18n?.t('i18n.selectLanguageAriaLabel') ?? 'Select display language',
	});

	function handleChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		onChange(select.value);
	}
</script>

<div class="locale-switcher" class:compact>
	{#if !compact}
		<label for="locale-select" class="locale-label">
			{translations.selectLanguage}:
		</label>
	{/if}

	<select
		id="locale-select"
		class="locale-select"
		value={currentLocale}
		onchange={handleChange}
		aria-label={translations.ariaLabel}
	>
		{#each availableLocales as { code, label }}
			<option value={code}>{label}</option>
		{/each}
	</select>
</div>

<style>
	.locale-switcher {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.locale-switcher.compact {
		gap: 0;
	}

	.locale-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-base-content, oklch(20% 0 0));
	}

	.locale-select {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-base-300, oklch(90% 0 0));
		border-radius: 0.375rem;
		background: var(--color-base-100, oklch(100% 0 0));
		color: var(--color-base-content, oklch(20% 0 0));
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.locale-select:hover {
		border-color: var(--color-primary, oklch(45% 0.24 277));
	}

	.locale-select:focus {
		outline: 2px solid var(--color-primary, oklch(45% 0.24 277));
		outline-offset: 2px;
		border-color: var(--color-primary, oklch(45% 0.24 277));
	}

	.locale-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Support for DaisyUI if available */
	:global(.theme-dark) .locale-select,
	:global([data-theme='dark']) .locale-select {
		background: var(--color-base-200, oklch(20% 0 0));
		border-color: var(--color-base-300, oklch(30% 0 0));
		color: var(--color-base-content, oklch(90% 0 0));
	}
</style>
