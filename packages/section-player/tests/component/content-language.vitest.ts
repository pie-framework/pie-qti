/**
 * Shared section content reads in the language it is written in (WCAG 3.1.2): test feedback,
 * passages and instructions render their block `language` as `lang` and `dir`, apart from the
 * interface language around them, and a passage's nested `xml:lang` becomes HTML `lang`.
 */

import { afterEach, describe, expect, test } from 'vitest';
import RubricDisplay from '../../src/components/RubricDisplay.svelte';
import TestFeedback from '../../src/components/TestFeedback.svelte';
import type { QtiSharedHtmlBlock } from '../../src/contracts/index.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

async function render(component: Parameters<typeof mountInto>[0], props: Record<string, unknown>) {
	const m = mountInto(component, props);
	mounted.push(m);
	await settle();
	return m;
}

function block(identifier: string, kind: QtiSharedHtmlBlock['kind'], rawHtml: string, language?: string): QtiSharedHtmlBlock {
	return {
		identifier,
		kind,
		scope: kind === 'test-feedback' ? 'assessment' : 'section',
		view: ['candidate'],
		rawHtml,
		...(language ? { language } : {}),
	};
}

describe('TestFeedback content language', () => {
	test('each feedback block carries its own lang and dir; undeclared feedback inherits', async () => {
		const m = await render(TestFeedback, {
			feedback: [
				block('fr', 'test-feedback', '<p>Bravo !</p>', 'fr'),
				block('ar', 'test-feedback', '<p>أحسنت</p>', 'ar'),
				block('none', 'test-feedback', '<p>Well done.</p>'),
			],
		});

		const contents = Array.from(m.host.querySelectorAll<HTMLElement>('.test-feedback-content'));
		// An empty `dir` is no direction: the block inherits its context's.
		expect(contents.map((el) => [el.textContent, el.getAttribute('lang'), el.getAttribute('dir') || null])).toEqual([
			['Bravo !', 'fr', 'ltr'],
			['أحسنت', 'ar', 'rtl'],
			['Well done.', null, null],
		]);
		// The region's name is interface text: the region itself takes no content language.
		expect(m.host.querySelector('section.test-feedback')?.hasAttribute('lang')).toBe(false);
	});

	test('a malformed language declaration sets nothing rather than a bogus lang', async () => {
		const m = await render(TestFeedback, { feedback: [block('bad', 'test-feedback', '<p>Text</p>', 'French')] });
		expect(m.host.querySelector('.test-feedback-content')?.hasAttribute('lang')).toBe(false);
	});
});

describe('RubricDisplay content language', () => {
	test('passages, instructions and rubrics carry their block language', async () => {
		const m = await render(RubricDisplay, {
			passages: [block('passage-fr', 'passage', "<p>Le cycle de l'eau.</p>", 'fr')],
			rubricBlocks: [
				block('directions-ar', 'instructions', '<p>اقرأ النص.</p>', 'ar'),
				block('rubric-es', 'rubric', '<p>Rúbrica</p>', 'es'),
			],
		});

		const passage = m.host.querySelector<HTMLElement>('.passage-content')!;
		expect([passage.getAttribute('lang'), passage.getAttribute('dir')]).toEqual(['fr', 'ltr']);
		const instructions = m.host.querySelector<HTMLElement>('.instructions-content')!;
		expect([instructions.getAttribute('lang'), instructions.getAttribute('dir')]).toEqual(['ar', 'rtl']);
		expect(m.host.querySelector('.rubric-block')?.getAttribute('lang')).toBe('es');
		// The passage heading and its controls stay in the interface language.
		expect(m.host.querySelector('.passage-header')?.closest('[lang]')).toBeNull();
	});

	test("a passage's nested xml:lang renders as HTML lang, with or without SSML", async () => {
		const m = await render(RubricDisplay, {
			passages: [
				block(
					'passage-ar',
					'passage',
					'<p>مرحبا <span xml:lang="en">hello</span></p>',
					'ar',
				),
			],
		});

		const nested = m.host.querySelector<HTMLElement>('.passage-content span')!;
		expect(nested.getAttribute('lang')).toBe('en');
		expect(nested.getAttribute('dir')).toBe('ltr');
	});
});
