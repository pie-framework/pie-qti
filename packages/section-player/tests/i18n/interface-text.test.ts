import { describe, expect, test } from 'bun:test';
import { DefaultI18nProvider, type I18nProvider } from '@pie-qti/i18n';
import { interfaceText } from '../../src/i18n/interface-text.js';

/** A provider for one locale holding only `catalog`; how it answers a miss is the variable. */
function provider(catalog: Record<string, string>, onMiss: (key: string, fallback?: string) => string): I18nProvider {
	return {
		getLocale: () => 'nl-NL',
		setLocale: () => {},
		t: (key, defaultOrValues) => catalog[key] ?? onMiss(key, typeof defaultOrValues === 'string' ? defaultOrValues : undefined),
	};
}

describe('interfaceText', () => {
	test('a translation the provider holds wins', () => {
		const i18n = provider({ 'assessment.collapsePassage': 'Tekst inklappen' }, (key) => key);
		expect(interfaceText(i18n, 'assessment.collapsePassage', 'Collapse passage')).toBe('Tekst inklappen');
	});

	test('a provider that answers a miss with the key gives the English default, never the key', () => {
		const i18n = provider({}, (key) => key);
		expect(interfaceText(i18n, 'assessment.collapsePassage', 'Collapse passage')).toBe('Collapse passage');
	});

	test('a provider that hands the default back gives it interpolated', () => {
		const i18n = provider({}, (key, fallback) => fallback ?? key);
		expect(interfaceText(i18n, 'sectionPlayer.passageNumbered', 'Passage {number}', { number: 2 })).toBe('Passage 2');
	});

	test('a key-echoing provider still gets the default interpolated', () => {
		const i18n = provider({}, (key) => key);
		expect(interfaceText(i18n, 'sectionPlayer.passageNumbered', 'Passage {number}', { number: 3 })).toBe('Passage 3');
	});

	test('without a provider the English default renders', () => {
		expect(interfaceText(undefined, 'common.close', 'Close')).toBe('Close');
	});

	test('the framework provider resolves its own catalog', () => {
		expect(interfaceText(new DefaultI18nProvider('en-US'), 'assessment.collapsePassage', 'unused')).toBe('Collapse passage');
	});
});
