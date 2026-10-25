import { describe, expect, test } from 'bun:test';
import type { I18nProvider as ToolkitI18nProvider } from '@pie-players/pie-assessment-toolkit';
import { DefaultI18nProvider, type I18nProvider } from '@pie-qti/i18n';

// One host provider serves the QTI players and the pie-players toolkit, so
// the QTI contract has to stay assignable to the toolkit's.
const asToolkitProvider = (provider: I18nProvider): ToolkitI18nProvider => provider;

describe('I18nProvider compatibility', () => {
	test('a QTI provider satisfies the toolkit contract', () => {
		const provider = new DefaultI18nProvider('en-US');
		const toolkitProvider = asToolkitProvider(provider);
		expect(toolkitProvider.getLocale()).toBe(provider.getLocale());
		expect(toolkitProvider.t('common.submit')).toBe(provider.t('common.submit'));
	});
});
