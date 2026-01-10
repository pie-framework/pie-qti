/**
 * Svelte context API for passing i18n instance through component tree
 * Including Shadow DOM boundaries
 */

import { getContext, setContext } from 'svelte';
import type { I18n } from './I18n.js';

const I18N_CONTEXT_KEY = Symbol('i18n');

/**
 * Provide i18n instance to component tree (including Shadow DOM)
 */
export function provideI18n(i18n: I18n): void {
	setContext(I18N_CONTEXT_KEY, i18n);
}

/**
 * Inject i18n instance from context
 */
export function injectI18n(): I18n {
	const i18n = getContext<I18n>(I18N_CONTEXT_KEY);
	if (!i18n) {
		throw new Error('[i18n] No i18n instance found in context. Call provideI18n() in parent component.');
	}
	return i18n;
}
