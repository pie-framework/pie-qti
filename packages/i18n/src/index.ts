/**
 * Public API exports for @pie-qti/i18n package
 */

// Core interface (framework-agnostic)
export type { I18nProvider, InterpolationValues, PluralOptions } from './core/I18nProvider.js';

// Default implementation
export { DefaultI18nProvider, createDefaultI18nProvider } from './core/I18n.js';

// Svelte-specific provider with opt-in persistence and reload
export {
	SvelteI18nProvider,
	createSvelteI18nProvider,
	createDefaultSvelteI18nProvider,
	DEFAULT_LOCALE_STORAGE_KEY,
} from './providers/SvelteI18nProvider.js';
export type { SvelteI18nProviderOptions } from './providers/SvelteI18nProvider.js';

// Language tags and locale negotiation
export {
	normalizeLanguageTag,
	languageTagLookupSequence,
	languageTagScript,
	languageTagScriptsMatch,
} from './core/language-tags.js';
export {
	FRAMEWORK_CATALOGS,
	localeLookupSequence,
	matchLanguageTag,
	resolveFrameworkLocale,
} from './core/negotiation.js';
export type { FrameworkCatalogCode } from './core/negotiation.js';

// Writing direction and the lang/dir pairs players write on their roots
export {
	canonicalLanguageTag,
	contentLanguageAttributes,
	interfaceLocaleAttributes,
	languageDirection,
} from './core/direction.js';
export type { LanguageAttributes, TextDirection } from './core/direction.js';

// Types
export type {
	LocaleCode,
	FrameworkLocaleCode,
	MessageKey,
	LocaleMessages,
} from './core/types.js';

// Example components (commented out - Svelte files need special build process)
// export { default as LocaleSwitcher } from './components/LocaleSwitcher.svelte';
