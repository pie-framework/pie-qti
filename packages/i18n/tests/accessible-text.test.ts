/**
 * Tests for `src/core/accessible-text.ts` and the hardcoded-string scan.
 */

import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanHardcodedStrings } from '../scripts/scan-hardcoded-strings.js';
import { formatList, isImeComposing, joinSentences, translate, translatePlural } from '../src/core/accessible-text.js';
import { DefaultI18nProvider } from '../src/core/I18n.js';
import type { I18nProvider } from '../src/core/I18nProvider.js';

async function arabic(): Promise<DefaultI18nProvider> {
	const provider = new DefaultI18nProvider('ar');
	await provider.loadLocale('ar');
	return provider;
}

describe('translate', () => {
	it('interpolates the English fallback without a provider', () => {
		expect(translate(undefined, 'interactions.match.pairCreated', '{source} matched with {target}.', { source: 'A', target: 'B' })).toBe(
			'A matched with B.',
		);
	});

	it('resolves the key through the provider', async () => {
		expect(translate(await arabic(), 'interactions.match.pairCreated', '{source} matched with {target}.', { source: 'A', target: 'B' })).toBe(
			'تمت مطابقة A مع B.',
		);
	});

	it('interpolates the fallback when the provider lacks the key', async () => {
		// A key missing from every catalog in the chain must not surface literal
		// "{source}" placeholders; the English fallback renders interpolated.
		expect(translate(await arabic(), 'no.such.key', '{source} matched with {target}.', { source: 'A', target: 'B' })).toBe(
			'A matched with B.',
		);
	});

	it('fills a fallback a host provider hands back verbatim', () => {
		const host: I18nProvider = {
			getLocale: () => 'en',
			setLocale: () => {},
			t: (_key, defaultOrValues) => String(defaultOrValues),
			formatNumber: (value) => `#${value}`,
		};
		expect(translate(host, 'no.such.key', 'Blank {index} of {count}', { index: 2, count: 5 })).toBe('Blank #2 of #5');
	});

	it('leaves a placeholder visible without a provider when its value is nullish', () => {
		// Same authoring-bug visibility as the provider path, never the word "undefined".
		expect(translate(undefined, 'no.such.key', 'Blank {index} of {count}', { index: 1, count: undefined })).toBe(
			'Blank 1 of {count}',
		);
	});
});

describe('translatePlural', () => {
	const fallback = { one: 'Play at least {count} time', other: 'Play at least {count} times' };

	it('picks the English form without a provider', () => {
		expect(translatePlural(undefined, 'interactions.media.playAtLeastCount', fallback, 1)).toBe('Play at least 1 time');
		expect(translatePlural(undefined, 'interactions.media.playAtLeastCount', fallback, 3)).toBe('Play at least 3 times');
	});

	it('selects the Arabic CLDR category', async () => {
		const ar = await arabic();
		expect(translatePlural(ar, 'interactions.media.playAtLeastCount', fallback, 2)).toBe('شغّل مرتين على الأقل');
		expect(translatePlural(ar, 'interactions.media.playAtLeastCount', fallback, 5)).toBe('شغّل 5 مرات على الأقل');
	});

	it('picks an interpolated English form when no catalog carries the group', async () => {
		// Never the raw key "no.such.group.other".
		const ar = await arabic();
		expect(translatePlural(ar, 'no.such.group', fallback, 1)).toBe('Play at least 1 time');
		expect(translatePlural(ar, 'no.such.group', fallback, 3)).toBe('Play at least 3 times');
	});

	it('picks an English form through a provider without plural support', () => {
		const host: I18nProvider = {
			getLocale: () => 'en',
			setLocale: () => {},
			t: (_key, defaultOrValues) => String(defaultOrValues),
		};
		expect(translatePlural(host, 'no.such.group', fallback, 3)).toBe('Play at least 3 times');
	});
});

describe('joinSentences', () => {
	it('joins the sentences that apply', () => {
		expect(joinSentences('Apple.', false, null, 'Correct answer.', undefined)).toBe('Apple. Correct answer.');
	});
});

describe('formatList', () => {
	it('joins with the provider locale conjunction', async () => {
		expect(formatList(undefined, ['Red', 'Green', 'Blue'])).toBe('Red, Green, and Blue');
		// Some ICU versions wrap each item in first-strong isolates.
		expect(formatList(await arabic(), ['Red', 'Green']).replace(/[⁨⁩]/g, '')).toBe('Red وGreen');
	});
});

describe('isImeComposing', () => {
	it('is true while composing or for the 229 keyCode', () => {
		const event = (init: Partial<KeyboardEvent>) => ({ isComposing: false, keyCode: 27, ...init }) as KeyboardEvent;
		expect(isImeComposing(event({ isComposing: true }))).toBe(true);
		expect(isImeComposing(event({ keyCode: 229 }))).toBe(true);
		expect(isImeComposing(event({}))).toBe(false);
	});
});

describe('scanHardcodedStrings', () => {
	it('reports template text and static or template-literal attributes, nothing else', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'scan-hardcoded-'));
		try {
			writeFileSync(
				join(dir, 'Sample.svelte'),
				[
					'<script>const diagnostic = "Not reported";</script>',
					'<p>Continue</p>',
					// biome-ignore lint/suspicious/noTemplateCurlyInString: fixture source text needs a literal Svelte template interpolation
					'<button aria-label={`Remove ${item}`} title="Close"></button>',
					'<input placeholder="Type {x}" />',
					'<Widget title="Component prop" />',
					'<p>{translate(i18n, "common.continue", "Continue")}</p>',
					'<span>✓ 3/4</span>',
					'<!-- i18n-ignore -->',
					'<code>console.log</code>',
				].join('\n'),
			);
			const { scanned, findings } = await scanHardcodedStrings([dir]);
			expect(scanned).toBe(1);
			expect(findings.map(({ channel, text, suggestedKey }) => ({ channel, text, suggestedKey }))).toEqual([
				{ channel: 'text', text: 'Continue', suggestedKey: 'common.continue' },
				{ channel: 'aria-label=', text: 'Remove {…}', suggestedKey: null },
				{ channel: 'title=', text: 'Close', suggestedKey: 'common.close' },
			]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
