/**
 * Tests for choiceName — the accessible name of an interactive choice: its
 * authored label, else a localized ordinal, never the QTI identifier.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { describe, expect, test } from 'bun:test';
import { choiceAccessibleName } from '../../../src/shared/utils/choiceName.js';

describe('choiceAccessibleName', () => {
	test('the authored label wins', () => {
		expect(choiceAccessibleName({ i18n: undefined, label: 'Paris', position: 3 })).toBe('Paris');
		expect(choiceAccessibleName({ i18n: undefined, label: 'Rome skyline', position: 1 })).toBe('Rome skyline');
	});

	test('a content-less choice falls back to a localized ordinal of its presented position', () => {
		expect(choiceAccessibleName({ i18n: undefined, label: '', position: 1 })).toBe('Choice 1');
		expect(choiceAccessibleName({ i18n: undefined, label: '', position: 12 })).toBe('Choice 12');
	});

	test('the ordinal comes from the catalog when a provider carries the key', async () => {
		const nl = new DefaultI18nProvider('nl');
		await nl.loadLocale('nl');
		expect(choiceAccessibleName({ i18n: nl, label: '', position: 2 })).toBe('Keuze 2');
	});

	test('whitespace-only content counts as content-less', () => {
		expect(choiceAccessibleName({ i18n: undefined, label: '   ', position: 4 })).toBe('Choice 4');
	});
});
