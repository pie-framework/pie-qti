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
	// The re-announce toggle of a repeated message is a trailing zero-width space.
	return (q(m, '[part="announcer"]')?.textContent ?? '').replace(/\u200b/g, '').trim();
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

	test('without an authored expected length neither counter class shows a counter, in either format', async () => {
		// Both counters are defined against expected-length (QTI 3 shared vocabulary §1.2.3.2:
		// counter-down starts at it, counter-up increases to it), and by default no counter is
		// displayed: no target is invented when the author gave none.
		for (const counterClass of ['qti-counter-down', 'qti-counter-up']) {
			for (const format of ['plain', 'xhtml']) {
				const { expectedLength: _absent, ...withoutLength } = extendedTextData({
					format,
					interactionClasses: [counterClass],
				});
				const m = mountExtendedText({ interaction: withoutLength });
				await settle();

				expect(q(m, '[part="counter"]')).toBeNull();
				expect(m.host.textContent).not.toMatch(/\/ ?\d+|remaining|200/);
				const field = q(m, format === 'xhtml' ? '[role="textbox"]' : 'textarea');
				expect(field).not.toBeNull();
				expect(field!.hasAttribute('aria-describedby')).toBe(false);

				if (format === 'plain') {
					type(q<HTMLTextAreaElement>(m, 'textarea')!, 'a'.repeat(250));
					await settle();
					expect(q(m, '[part="counter"]')).toBeNull();
					expect(announcement(m)).toBe('');
				}
				cleanupInteraction(...mounted.splice(0));
			}
		}
	});

	test('the box size does not depend on expectedLength: rows come from expectedLines', async () => {
		const { expectedLength: _absent, ...withoutLength } = extendedTextData({ expectedLines: 4 });
		const m = mountExtendedText({ interaction: withoutLength });
		await settle();

		expect(q<HTMLTextAreaElement>(m, 'textarea')!.getAttribute('rows')).toBe('4');
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

// patternMask (QTI 2.1; QTI 3.0 §5.48.4): a string response that does not match it is invalid
// under validateResponses. The field says so where the candidate is (WCAG 3.3.1), at the moment
// the text entry does: when the candidate leaves the field.
describe('ExtendedTextInteraction patternMask message', () => {
	function editable(m: MountedInteraction) {
		return q<HTMLElement>(m, '[contenteditable]')!;
	}

	test('a plain response that fails its patternMask shows the authored message on blur', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({
				prompt: null,
				placeholderText: '',
				patternMask: '[0-9]+',
				patternMaskMessage: 'Numbers only, please.',
			}),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		// Nothing shows while the candidate types: the check waits for the field to lose focus.
		type(textarea, 'not numbers');
		await settle();
		expect(q(m, '[part="pattern-error"]')).toBeNull();
		expect(announcement(m)).toBe('');

		textarea.dispatchEvent(new FocusEvent('blur'));
		await settle();

		const error = q(m, '[part="pattern-error"]');
		expect(error?.textContent?.trim()).toBe('Numbers only, please.');
		// The message is the failing field's description, and the field states the invalid state.
		expect(textarea.getAttribute('aria-invalid')).toBe('true');
		expect(textarea.getAttribute('aria-describedby')?.split(/\s+/)).toContain(error!.id);
		// It is announced politely once, through the interaction's live region.
		expect(announcement(m)).toBe('Numbers only, please.');
		// Typing is never blocked.
		expect(textarea.disabled).toBe(false);
		expect(m.events).toHaveLength(1);
	});

	test('without an authored message a localized generic sentence shows', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ prompt: null, placeholderText: '', patternMask: '[0-9]+' }),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		type(textarea, 'abc');
		await settle();
		textarea.dispatchEvent(new FocusEvent('blur'));
		await settle();

		expect(q(m, '[part="pattern-error"]')?.textContent?.trim()).toBe('This answer is not in the expected format.');
	});

	test('a matching response clears the message and the invalid state', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({
				prompt: null,
				placeholderText: '',
				base: 10,
				patternMask: '[0-9]+',
				patternMaskMessage: 'Numbers only.',
			}),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		type(textarea, 'abc');
		await settle();
		textarea.dispatchEvent(new FocusEvent('blur'));
		await settle();
		expect(q(m, '[part="pattern-error"]')).toBeTruthy();

		type(textarea, '42');
		await settle();

		expect(q(m, '[part="pattern-error"]')).toBeNull();
		expect(textarea.hasAttribute('aria-invalid')).toBe(false);
		expect(textarea.getAttribute('aria-describedby') ?? '').not.toContain('pattern-error');
	});

	test('the message stays while the candidate keeps typing text that still fails the mask', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({
				prompt: null,
				placeholderText: '',
				base: 10,
				patternMask: '[a-z]+',
				patternMaskMessage: 'Letters only.',
			}),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		type(textarea, '12');
		await settle();
		textarea.dispatchEvent(new FocusEvent('blur'));
		await settle();
		expect(q(m, '[part="pattern-error"]')?.textContent?.trim()).toBe('Letters only.');

		type(textarea, '123');
		await settle();

		expect(q(m, '[part="pattern-error"]')?.textContent?.trim()).toBe('Letters only.');
		expect(textarea.getAttribute('aria-invalid')).toBe('true');
	});

	test('each response of a multi-part answer is checked on its own, and its message moves with it', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({
				cardinality: 'ordered',
				minStrings: 0,
				maxStrings: 0,
				patternMask: '[a-z]+',
				patternMaskMessage: 'Letters only.',
			}),
			response: ['alpha', 'BETA'],
		});
		await settle();

		let areas = qa<HTMLTextAreaElement>(m, 'textarea');
		areas[0]!.dispatchEvent(new FocusEvent('blur'));
		areas[1]!.dispatchEvent(new FocusEvent('blur'));
		await settle();

		// Only the second response fails, so only it is invalid and described by the message.
		expect(qa(m, '[part="pattern-error"]')).toHaveLength(1);
		expect(areas[0]!.hasAttribute('aria-invalid')).toBe(false);
		expect(areas[1]!.getAttribute('aria-invalid')).toBe('true');
		expect(areas[1]!.getAttribute('aria-describedby')).toBe(q(m, '[part="pattern-error"]')!.id);

		// Removing the first response moves the failing one up; its message moves with it.
		await click(qa<HTMLButtonElement>(m, 'button[part="remove-string"]')[0]!);
		areas = qa<HTMLTextAreaElement>(m, 'textarea');
		expect(areas).toHaveLength(1);
		expect(areas[0]!.value).toBe('BETA');
		expect(areas[0]!.getAttribute('aria-invalid')).toBe('true');
		expect(areas[0]!.getAttribute('aria-describedby')).toBe(q(m, '[part="pattern-error"]')!.id);
	});

	test('an empty response is never flagged: the mask constrains entered text only', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({ prompt: null, placeholderText: '', patternMask: '[0-9]+' }),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		textarea.dispatchEvent(new FocusEvent('blur'));
		await settle();

		expect(q(m, '[part="pattern-error"]')).toBeNull();
		expect(textarea.hasAttribute('aria-invalid')).toBe(false);
	});

	test('a numeric response is not flagged: validation enforces the mask on string responses only', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({
				prompt: null,
				placeholderText: '',
				baseType: 'integer',
				patternMask: '[0-9]+',
			}),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		type(textarea, 'abc');
		await settle();
		textarea.dispatchEvent(new FocusEvent('blur'));
		await settle();

		expect(q(m, '[part="pattern-error"]')).toBeNull();
		expect(textarea.hasAttribute('aria-invalid')).toBe(false);
	});

	test('a rich text response that fails its patternMask shows the message when focus leaves the editor', async () => {
		const m = mountExtendedText({
			interaction: extendedTextData({
				format: 'xhtml',
				prompt: null,
				placeholderText: '',
				patternMask: '[0-9]+',
				patternMaskMessage: 'Numbers only.',
			}),
			response: '<p>not numbers</p>',
		});
		await settle();

		const surface = editable(m);
		expect(q(m, '[part="pattern-error"]')).toBeNull();

		// Focus leaves the editor surface (nothing takes it inside the field).
		surface.dispatchEvent(new FocusEvent('focusout', { relatedTarget: null, bubbles: true }));
		await settle();

		const error = q(m, '[part="pattern-error"]');
		expect(error?.textContent?.trim()).toBe('Numbers only.');
		expect(surface.getAttribute('aria-invalid')).toBe('true');
		expect(surface.getAttribute('aria-describedby')?.split(/\s+/)).toContain(error!.id);
		expect(announcement(m)).toBe('Numbers only.');
	});
});

// A string response is the candidate's text. Text that happens to read as JSON (a number, a
// literal, a quoted string, an array) is still that text: the field shows it and reports it as
// written, however the host hands it back.
describe('ExtendedTextInteraction keeps a string answer exactly as written', () => {
	const JSON_LOOKING_ANSWERS = ['1.50', '1e5', 'true', 'null', '"quoted"', '[1]'];
	// A valid base keeps these about the response's text alone.
	const stringData = () => extendedTextData({ base: 10 });

	test.each(JSON_LOOKING_ANSWERS)('a response of %s set by the host stays exactly that text', async (answer) => {
		const m = mountExtendedText({ interaction: stringData(), response: answer });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		expect(textarea.value).toBe(answer);

		// The candidate's next edit starts from that text; an edit that keeps it reports it unchanged.
		type(textarea, answer);
		await settle();
		expect(m.events.at(-1)!.detail.value).toBe(answer);
		expect(m.instance.response).toBe(answer);
		expect(textarea.value).toBe(answer);
	});

	test.each(JSON_LOOKING_ANSWERS)('typing %s reports it unchanged and the field keeps it', async (answer) => {
		const m = mountExtendedText({ interaction: stringData() });
		await settle();

		// Character by character, as a candidate types: no prefix is rewritten either.
		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		for (let end = 1; end <= answer.length; end++) {
			type(textarea, answer.slice(0, end));
			await settle();
			expect(textarea.value).toBe(answer.slice(0, end));
		}
		expect(m.events.map((event) => event.detail.value)).toEqual(
			Array.from({ length: answer.length }, (_, index) => answer.slice(0, index + 1)),
		);
		expect(m.instance.response).toBe(answer);

		// The item player sets the response it stored back on the element as a property, and
		// assigns the interaction data again with it.
		m.instance.response = answer;
		m.instance.interaction = stringData();
		await settle();
		expect(textarea.value).toBe(answer);
		expect(m.events).toHaveLength(answer.length);
	});

	test.each(JSON_LOOKING_ANSWERS)('a correct response of %s is shown as that text', async (answer) => {
		const m = mountExtendedText({
			interaction: stringData(),
			role: 'scorer',
			disabled: true,
			correctResponse: answer,
		});
		await settle();

		const correct = q(m, '[part="correct-answer"]');
		expect(correct).not.toBeNull();
		// The heading, then one line per correct string.
		expect(Array.from(correct!.children).slice(1).map((line) => line.textContent)).toEqual([answer]);
	});

	test.each([
		['float', '1.50', 1.5],
		['float', '1e5', 100000],
		['integer', '42', 42],
	] as const)('a %s response reports the number %s reads as, and the field keeps the text', async (baseType, typed, value) => {
		const m = mountExtendedText({ interaction: extendedTextData({ baseType, base: 10 }) });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		type(textarea, typed);
		await settle();
		expect(m.events[0]!.detail.value).toBe(value);
		expect(m.instance.response).toBe(value);

		// The player stores the number and sets it back, with the interaction data: the field keeps
		// what the candidate typed.
		m.instance.response = value;
		m.instance.interaction = extendedTextData({ baseType, base: 10 });
		await settle();
		expect(textarea.value).toBe(typed);
	});

	test('a numeric response set by the host shows as its number', async () => {
		const m = mountExtendedText({ interaction: extendedTextData({ baseType: 'float', base: 10 }), response: 1.5 });
		await settle();

		expect(q<HTMLTextAreaElement>(m, 'textarea')!.value).toBe('1.5');
	});
});

// The item player hands every prop to the interaction's custom element as a JavaScript property
// (`assignProps`); HTML markup can give the interaction data as a JSON attribute instead.
describe('pie-qti-extended-text custom element', () => {
	type ExtendedTextElement = HTMLElement & Record<string, unknown>;

	const elements: HTMLElement[] = [];

	afterEach(() => {
		for (const element of elements.splice(0)) element.remove();
	});

	async function connect(element: ExtendedTextElement) {
		const events: CustomEvent[] = [];
		element.addEventListener('qti-change', (event) => events.push(event as CustomEvent));
		document.body.appendChild(element);
		elements.push(element);
		// The element mounts its component a microtask after it connects.
		await settle();
		await settle();
		const textarea = element.shadowRoot?.querySelector<HTMLTextAreaElement>('textarea') ?? null;
		return { events, textarea };
	}

	test('a string response set as a property is never re-read as JSON', async () => {
		const element = document.createElement('pie-qti-extended-text') as ExtendedTextElement;
		Object.assign(element, { interaction: extendedTextData({ base: 10 }), response: '1.50' });
		const { events, textarea } = await connect(element);

		expect(textarea?.value).toBe('1.50');

		type(textarea!, '1e5');
		await settle();
		expect(events.map((event) => event.detail.value)).toEqual(['1e5']);
		expect(textarea!.value).toBe('1e5');

		// The player sets the stored response back, as it does after every change.
		element.response = '1e5';
		await settle();
		expect(textarea!.value).toBe('1e5');

		element.response = 'null';
		await settle();
		expect(textarea!.value).toBe('null');
	});

	test('interaction data given as a JSON attribute still renders the interaction', async () => {
		const element = document.createElement('pie-qti-extended-text') as ExtendedTextElement;
		element.setAttribute('interaction', JSON.stringify(extendedTextData({ base: 10 })));
		const { events, textarea } = await connect(element);

		expect(textarea).not.toBeNull();
		expect(element.shadowRoot?.querySelector('[part="prompt"]')?.textContent?.trim()).toBe('Explain your reasoning.');

		type(textarea!, '1.50');
		await settle();
		expect(events.map((event) => event.detail.value)).toEqual(['1.50']);
		expect(textarea!.value).toBe('1.50');
	});
});

// `base` is the number base the candidate's text is read in, 10 when not authored (QTI 2.1 and
// QTI 3.0 extendedTextInteraction). Data whose base is not a usable one (an integer from 2 through
// 36: digits 0-9, then A-Z) is read in base 10, never with an error.
describe('ExtendedTextInteraction with an invalid base', () => {
	test.each([0, 1, 37, Number.NaN, 2.5, undefined])('base %s reads and shows numbers in base 10 instead of throwing', async (base) => {
		const interaction = { ...extendedTextData({ baseType: 'integer' }), base } as ExtendedTextInteractionData;
		const m = mountExtendedText({ interaction, response: 255 });
		await settle();

		const textarea = q<HTMLTextAreaElement>(m, 'textarea')!;
		expect(textarea.value).toBe('255');

		type(textarea, '42');
		await settle();
		expect(m.events[0]!.detail.value).toBe(42);
		expect(textarea.value).toBe('42');
	});
});
