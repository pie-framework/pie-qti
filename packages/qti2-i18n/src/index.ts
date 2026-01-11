/**
 * Public API exports for @pie-qti/qti2-i18n package
 */

// Core interface (framework-agnostic)
export type { I18nProvider, InterpolationValues, PluralOptions } from './core/I18nProvider.js';

// Default implementation
export { DefaultI18nProvider, createDefaultI18nProvider } from './core/I18n.js';

// Svelte-specific provider with reactive stores
export { SvelteI18nProvider, createSvelteI18nProvider, createDefaultSvelteI18nProvider } from './providers/SvelteI18nProvider.js';

// Types
export type {
	LocaleCode,
	MessageKey,
	LocaleMessages,
} from './core/types.js';

// Example components
export { default as LocaleSwitcher } from './components/LocaleSwitcher.svelte';
