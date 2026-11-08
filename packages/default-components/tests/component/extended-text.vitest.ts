import { afterEach, describe, expect, test } from 'vitest';
import type { ExtendedTextInteractionData } from '@pie-qti/item-player';
import ExtendedTextInteraction from '../../src/plugins/extended-text/ExtendedTextInteraction.svelte';
import {
	cleanupInteraction,
	type MountedInteraction,
	mountInteraction,
	qa,
	q,
	settle,
	type,
} from './helpers';

function extendedTextData(
	overrides: Partial<ExtendedTextInteractionData> = {},
): ExtendedTextInteractionData {
	return {
		type: 'extendedTextInteraction',
		responseId: 'RESPONSE',
		cardinality: 'single',
		base: 0,
		baseType: 'string',
		minStrings: 0,
		maxStrings: 0,
		expectedLines: 3,
		expectedLength: 0,
		prompt: '<p>Explain your reasoning.</p>',
		placeholderText: 'Type here',
		format: 'plain',
		...overrides,
	};
}

const mounted: MountedInteraction[] = [];

function mountExtendedText(props: Record<string, unknown>) {
	const instance = mountInteraction(ExtendedTextInteraction, props);
	mounted.push(instance);
	return instance;
}

function announcement(m: MountedInteraction): string {
	return (q(m, '[part="announcer"]')?.textContent ?? '').trim();
}

async function click(element: Element) {
	element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await settle();
}

/** The accessible name a screen reader computes from aria-labelledby, aria-label or a label. */
function accessibleName(element: Element): string {
	const labelledby = element.getAttribute('aria-labelledby');
	if (labelledby) {
		return labelledby
			.split(/\s+/)
			.map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
			.join(' ')
			.trim();
	}
	const label = element.getAttribute('aria-label');
	if (label) return label;
	const labels = (element as HTMLTextAreaElement).labels;
	return labels && labels.length > 0 ? Array.from(labels).map((l) => l.textContent?.trim()).join(' ') : '';
}

afterEach(() => {
	cleanupInteraction(...mounted.splice(0));
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('ExtendedTextInteraction (pie-qti-extended-text)', () => {
	test('plain-format items render a textarea and typing emits the response', async () => {
		const m = mountExtendedText({ interaction: extendedTextData() });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea');
		expect(textarea).toBeTruthy();

		type(textarea!, 'Photosynthesis converts light.');
		await settle();

		expect(m.instance.response).toBe('Photosynthesis converts light.');
		expect(m.events).toHaveLength(1);
		expect(m.events[0]!.detail).toMatchObject({
			responseId: 'RESPONSE',
			value: 'Photosynthesis converts light.',
		});
	});

	test('the prompt names the field and the placeholder stays a hint', async () => {
		const m = mountExtendedText({ interaction: extendedTextData() });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		const prompt = q(m, '[part="prompt"]')!;
		expect(textarea.getAttribute('aria-labelledby')).toBe(prompt.id);
		expect(accessibleName(textarea)).toBe('Explain your reasoning.');
		expect(textarea.hasAttribute('aria-label')).toBe(false);
		expect(textarea.getAttribute('placeholder')).toBe('Type here');
	});

	test('without a prompt the field gets a generic localized name, not the placeholder', async () => {
		const m = mountExtendedText({ interaction: extendedTextData({ prompt: null }) });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		expect(textarea.getAttribute('aria-label')).toBe('Response');
		expect(textarea.getAttribute('placeholder')).toBe('Type here');
	});

	test('the counter describes the field quietly and announces only on reaching the expected length', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ expectedLength: 5, interactionClasses: ['qti-counter-down'] }),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		const counter = q(m, '[part="counter"]')!;
		expect(counter.hasAttribute('aria-live')).toBe(false);
		expect(counter.getAttribute('role')).toBeNull();
		expect(textarea.getAttribute('aria-describedby')).toBe(counter.id);
		expect(counter.textContent).toBe('5 characters remaining');

		type(textarea, 'abcd');
		await settle();
		expect(counter.textContent).toBe('1 character remaining');
		expect(announcement(m)).toBe('');

		type(textarea, 'abcde');
		await settle();
		expect(counter.textContent).toBe('0 characters remaining');
		expect(announcement(m)).toBe('Expected length of 5 characters reached.');

		// Typing on past the threshold says nothing more.
		const live = q(m, '[part="announcer"]')!;
		const before = live.textContent;
		type(textarea, 'abcdef');
		await settle();
		expect(live.textContent).toBe(before);

		// Dropping below and reaching it again is a new moment worth hearing.
		type(textarea, 'abc');
		await settle();
		expect(live.textContent).toBe(before);
		type(textarea, 'abcde');
		await settle();
		expect(live.textContent).not.toBe(before);
		expect(announcement(m)).toBe('Expected length of 5 characters reached.');
	});

	test('the counting-up counter shows used of expected characters', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ expectedLength: 20, interactionClasses: ['qti-counter-up'] }),
		});
		await settle();

		type(q<HTMLTextAreaElement>(m, 'textarea')!, 'abcd');
		await settle();
		expect(q(m, '[part="counter"]')!.textContent).toBe('4 / 20 characters');
	});

	test('multiple strings get one independently named region each', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ cardinality: 'multiple', minStrings: 0, maxStrings: 3 }),
		});
		await settle();

		expect(qa(m, 'textarea')).toHaveLength(1);

		// The candidate grows the answer set explicitly with the add-string control.
		await click(q(m, 'button[part="add-string"]')!);
		expect(qa(m, 'textarea')).toHaveLength(2);
		// Adding moves focus to the new, empty response.
		expect(document.activeElement).toBe(qa(m, 'textarea')[1]);

		const areas = qa<HTMLTextAreaElement>(m, 'textarea');
		type(areas[0]!, 'first');
		type(areas[1]!, 'second');
		await settle();
		expect(m.instance.response).toEqual(['first', 'second']);

		// The prompt names the group; each field is named by its visible label.
		const group = q(m, '[part="editor"]')!;
		expect(group.getAttribute('role')).toBe('group');
		expect(group.getAttribute('aria-labelledby')).toBe(q(m, '[part="prompt"]')!.id);
		expect(areas.map(accessibleName)).toEqual(['Response 1', 'Response 2']);
		expect(qa(m, '[part="string-label"]').map((label) => label.textContent?.trim())).toEqual([
			'Response 1',
			'Response 2',
		]);
	});

	test('remove buttons name the response they remove and keep focus nearby', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ cardinality: 'ordered', minStrings: 0, maxStrings: 0 }),
			response: ['alpha', 'beta', 'gamma'],
		});
		await settle();

		const removeButtons = qa<HTMLButtonElement>(m, 'button[part="remove-string"]');
		expect(removeButtons.map((button) => button.textContent?.trim())).toEqual([
			'Remove response 1',
			'Remove response 2',
			'Remove response 3',
		]);
		// Distinct visible names, so no aria-label overrides them.
		expect(removeButtons.every((button) => !button.hasAttribute('aria-label'))).toBe(true);

		// Removing the last response focuses the one before it.
		removeButtons[2]!.focus();
		await click(removeButtons[2]!);
		expect(m.instance.response).toEqual(['alpha', 'beta']);
		expect(document.activeElement).toBe(qa(m, 'textarea')[1]);
		expect(announcement(m)).toBe('Response 3 removed.');

		// Removing the first response focuses the response that moved up into its place.
		const first = qa<HTMLButtonElement>(m, 'button[part="remove-string"]')[0]!;
		first.focus();
		await click(first);
		expect(m.instance.response).toEqual(['beta']);
		expect(document.activeElement).toBe(qa(m, 'textarea')[0]);
		expect(qa<HTMLTextAreaElement>(m, 'textarea')[0]!.value).toBe('beta');
		expect(announcement(m)).toBe('Response 1 removed.');
	});

	test('spell check, autocorrect and autocapitalize are off by default', async () => {
		const m = mountExtendedText({ interaction: extendedTextData() });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		expect(textarea.getAttribute('spellcheck')).toBe('false');
		expect(textarea.getAttribute('autocorrect')).toBe('off');
		expect(textarea.getAttribute('autocapitalize')).toBe('off');
	});

	test.each([
		[true, 'true', 'on'],
		['true', 'true', 'on'],
		['', 'true', 'on'],
		['false', 'false', 'off'],
		[false, 'false', 'off'],
	])('the spellcheck prop %j opts in to spelling help', async (spellcheck, expected, autocorrect) => {
		const m = mountExtendedText({ interaction: extendedTextData(), spellcheck });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		expect(textarea.getAttribute('spellcheck')).toBe(expected);
		expect(textarea.getAttribute('autocorrect')).toBe(autocorrect);
		// Capitalization is assessed in writing items: never automatic.
		expect(textarea.getAttribute('autocapitalize')).toBe('off');
	});

	test('a PNP spell-checker grant opts in like the prop, object or JSON', async () => {
		const granted = mountExtendedText({
			interaction: extendedTextData({ responseId: 'PNP_A', prompt: null }),
			pnp: { cognitive: { spellChecker: true } },
		});
		const grantedJson = mountExtendedText({
			interaction: extendedTextData({ responseId: 'PNP_B', prompt: null }),
			pnp: JSON.stringify({ cognitive: { spellChecker: true } }),
		});
		const withoutGrant = mountExtendedText({
			interaction: extendedTextData({ responseId: 'PNP_C', prompt: null }),
			pnp: { cognitive: {} },
		});
		await settle();

		for (const m of [granted, grantedJson]) {
			const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
			expect(textarea.getAttribute('spellcheck')).toBe('true');
			expect(textarea.getAttribute('autocorrect')).toBe('on');
		}
		expect(q<HTMLTextAreaElement>(withoutGrant, 'textarea')!.getAttribute('spellcheck')).toBe('false');
	});

	test('the PNP spell-checker grant reaches the rich text editor too', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ format: 'xhtml', responseId: 'PNP_RICH', prompt: null }),
			pnp: { cognitive: { spellChecker: true } },
		});
		await settle();

		const surface = q<HTMLElement>(m, '[contenteditable]')!;
		expect(surface.getAttribute('spellcheck')).toBe('true');
		expect(surface.getAttribute('autocorrect')).toBe('on');
		expect(surface.getAttribute('autocapitalize')).toBe('off');
	});

	test.each([
		// A numeric keyboard is only safe when the patternMask proves the answer
		// cannot be negative: phone number pads have no minus key.
		['integer', 10, 'single', '^[0-9]+$', 'numeric'],
		['float', 10, 'single', '[0-9]+([.][0-9]+)?', 'decimal'],
		[undefined, 10, 'record', '[0-9]+', 'decimal'],
		// No mask, or a mask that can match `-`, keeps the text keyboard.
		['integer', 10, 'single', null, null],
		['float', 10, 'single', null, null],
		['integer', 10, 'single', '-?[0-9]+', null],
		['string', 10, 'single', '^[0-9]+$', null],
		// Digits above 9 are letters in base 16.
		['integer', 16, 'single', '^[0-9]+$', null],
	] as const)(
		'a %s response in base %d (%s) masked %j gets inputmode %j',
		async (baseType, base, cardinality, patternMask, inputmode) => {
			const m = mountExtendedText({ interaction: extendedTextData({ baseType, base, cardinality, patternMask }) });
			await settle();

			expect(q(m, 'textarea')!.getAttribute('inputmode')).toBe(inputmode);
		},
	);

	test('disabled items render a disabled textarea that emits nothing', async () => {
		const m = mountExtendedText({ interaction: extendedTextData(), disabled: true });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		expect(textarea.disabled).toBe(true);
		// A disabled textarea must not react to activation (clicks are no-ops on it).
		textarea.click();
		await settle();

		expect(m.instance.response).toBeUndefined();
		expect(m.events).toHaveLength(0);
	});

	test('uses the i18n provider for names, counters and announcements', async () => {
		const messages: Record<string, string> = {
			'interactions.extendedText.responseLabel': 'Antwoord',
			'interactions.extendedText.expectedLengthReached.other': 'Verwachte lengte van {count} tekens bereikt.',
		};
		const i18n = {
			getLocale: () => 'nl',
			setLocale: () => {},
			t: (key: string, fallback?: unknown, values?: Record<string, unknown>) => {
				const message = messages[key] ?? (typeof fallback === 'string' ? fallback : key);
				return message.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ''));
			},
		};
		const m = mountExtendedText({
			interaction: extendedTextData({ prompt: null, expectedLength: 2, interactionClasses: ['qti-counter-up'] }),
			i18n,
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		expect(textarea.getAttribute('aria-label')).toBe('Antwoord');
		type(textarea, 'ab');
		await settle();
		expect(announcement(m)).toBe('Verwachte lengte van 2 tekens bereikt.');
	});
});

describe('ExtendedTextInteraction rich text (format="xhtml")', () => {
	function editable(m: MountedInteraction) {
		return q<HTMLElement>(m, '[contenteditable]')!;
	}

	test('the editor surface is named by the prompt and keeps the placeholder a hint', async () => {
		const m = mountExtendedText({ interaction: extendedTextData({ format: 'xhtml' }) });
		await settle();

		const surface = editable(m);
		expect(surface.getAttribute('role')).toBe('textbox');
		expect(surface.getAttribute('aria-multiline')).toBe('true');
		expect(surface.getAttribute('aria-labelledby')).toBe(q(m, '[part="prompt"]')!.id);
		expect(surface.hasAttribute('aria-label')).toBe(false);
		expect(surface.getAttribute('aria-placeholder')).toBe('Type here');
	});

	test('writing assistance is off by default and follows the spellcheck prop', async () => {
		const off = mountExtendedText({ interaction: extendedTextData({ format: 'xhtml' }) });
		const on = mountExtendedText({
			interaction: extendedTextData({ format: 'xhtml', responseId: 'OTHER' }),
			spellcheck: true,
		});
		await settle();

		expect(editable(off).getAttribute('spellcheck')).toBe('false');
		expect(editable(off).getAttribute('autocorrect')).toBe('off');
		expect(editable(off).getAttribute('autocapitalize')).toBe('off');
		expect(editable(on).getAttribute('spellcheck')).toBe('true');
		expect(editable(on).getAttribute('autocorrect')).toBe('on');
		expect(editable(on).getAttribute('autocapitalize')).toBe('off');
	});

	test('toolbar buttons are named, report their toggle state, and the read-only state is exposed', async () => {
		const m = mountExtendedText({ interaction: extendedTextData({ format: 'xhtml' }), disabled: true });
		await settle();

		const buttons = qa<HTMLButtonElement>(m, 'button[part="toolbar-button"]');
		expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim())).toEqual([
			'Bold',
			'Italic',
			'Insert inline math',
			'Insert block math',
			'Edit math',
		]);
		expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
		expect(buttons.every((button) => button.disabled)).toBe(true);
		expect(editable(m).getAttribute('aria-readonly')).toBe('true');
	});

	test('the counter describes the rich text editor', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ format: 'xhtml', expectedLength: 10, interactionClasses: ['qti-counter-down'] }),
		});
		await settle();

		expect(editable(m).getAttribute('aria-describedby')).toBe(q(m, '[part="counter"]')!.id);
	});
});
