/**
 * Public API exports for @pie-qti/qti2-i18n package
 */

// Core functionality
export { I18n } from './core/I18n.js';
export { initI18n, getI18n, setLocale, t, plural, formatNumber, formatDate, locale } from './core/store.js';
export { provideI18n, injectI18n } from './core/context.js';

// Components
export { default as LocaleSwitcher } from './components/LocaleSwitcher.svelte';

// Types
export type {
	LocaleCode,
	MessageKey,
	InterpolationValues,
	PluralOptions,
	LocaleMessages,
} from './core/types.js';
