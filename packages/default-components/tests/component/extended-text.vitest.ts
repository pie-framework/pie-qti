import { afterEach, describe, expect, test } from 'vitest';
import type { ExtendedTextInteractionData } from '@pie-qti/item-player';
import ExtendedTextInteraction from '../../src/plugins/extended-text/ExtendedTextInteraction.svelte';
import {
	cleanupInteraction,
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

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('ExtendedTextInteraction (pie-qti-extended-text)', () => {
	test('plain-format items render a textarea and typing emits the response', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, {
			interaction: extendedTextData(),
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(mounted, 'textarea');
		expect(textarea).toBeTruthy();
		expect(textarea?.getAttribute('aria-label')).toBe('Type here');

		type(textarea!, 'Photosynthesis converts light.');
		await settle();

		expect(mounted.instance.response).toBe('Photosynthesis converts light.');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({
			responseId: 'RESPONSE',
			value: 'Photosynthesis converts light.',
		});
	});

	test('the expected-length counter counts down while typing', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, {
			interaction: extendedTextData({ expectedLength: 20, interactionClasses: ['qti-counter-down'] }),
		});
		await settle();

		type(q<HTMLTextAreaElement>(mounted, 'textarea')!, 'abcd');
		await settle();

		const counter = q(mounted, '[part="counter"]');
		expect(counter?.getAttribute('aria-live')).toBe('polite');
		expect(counter?.textContent).toContain('16');
	});

	test('multiple strings get one independently editable region each', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, {
			interaction: extendedTextData({ cardinality: 'multiple', minStrings: 0, maxStrings: 3 }),
		});
		await settle();

		expect(qa(mounted, 'textarea')).toHaveLength(1);

		// The candidate grows the answer set explicitly with the add-string control.
		q(mounted, 'button[part="add-string"]')?.dispatchEvent(
			new MouseEvent('click', { bubbles: true }),
		);
		await settle();
		expect(qa(mounted, 'textarea')).toHaveLength(2);

		const areas = qa<HTMLTextAreaElement>(mounted, 'textarea');
		type(areas[0]!, 'first');
		type(areas[1]!, 'second');
		await settle();
		expect(mounted.instance.response).toEqual(['first', 'second']);
	});

	test('disabled items render a disabled textarea that emits nothing', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, {
			interaction: extendedTextData(),
			disabled: true,
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(mounted, 'textarea')!;
		expect(textarea.disabled).toBe(true);
		// A disabled textarea must not react to activation (clicks are no-ops on it).
		textarea.click();
		await settle();

		expect(mounted.instance.response).toBeUndefined();
		expect(mounted.events).toHaveLength(0);
	});
});
