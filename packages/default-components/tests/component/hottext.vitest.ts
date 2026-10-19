import { afterEach, describe, expect, test } from 'vitest';
import type { HottextInteractionData } from '@pie-qti/item-player';
import HottextInteraction from '../../src/plugins/hottext/HottextInteraction.svelte';
import {
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
} from './helpers';

function hottextData(overrides: Partial<HottextInteractionData> = {}): HottextInteractionData {
	return {
		type: 'hottextInteraction',
		responseId: 'RESPONSE',
		prompt: '<p>Click the plants.</p>',
		maxChoices: 1,
		minChoices: 0,
		contentHtml:
			'<p>The <hottext identifier="H1">fern</hottext> and the <hottext identifier="H2">oak</hottext> are plants; a <hottext identifier="H3">rock</hottext> is not.</p>',
		hottextChoices: [
			{ identifier: 'H1' },
			{ identifier: 'H2' },
			{ identifier: 'H3' },
		],
		...overrides,
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('HottextInteraction (pie-qti-hottext)', () => {
	test('renders every hottext span as a keyboard-reachable button', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const hottexts = qa(mounted, '[role="button"]');
		expect(hottexts).toHaveLength(3);
		for (const hottext of hottexts) {
			expect(hottext.getAttribute('tabindex')).toBe('0');
			expect(hottext.getAttribute('aria-pressed')).toBe('false');
			expect(hottext.getAttribute('aria-label')).toContain('Selectable text');
		}
	});

	test('clicking a hottext selects it and emits a single-value response', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[1]!;
		target.click();
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'H2' });
		expect(target.getAttribute('aria-pressed')).toBe('true');
		expect(q(mounted, '[part="footer"]')?.textContent).toContain('1 / 3');
	});

	test('Enter activates the focused hottext', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[0]!;
		pressKey(target, 'Enter');
		await settle();

		expect(mounted.instance.response).toBe('H1');
		expect(target.getAttribute('aria-pressed')).toBe('true');
	});

	test('Space activates the focused hottext', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[2]!;
		pressKey(target, ' ');
		await settle();

		expect(mounted.instance.response).toBe('H3');
	});

	test('activating a selected hottext deselects it and reports the cleared response', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[0]!;
		target.click();
		await settle();
		target.click();
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: null });
		expect(target.getAttribute('aria-pressed')).toBe('false');
	});

	test('clear selection resets the state and emits the cleared response', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		qa(mounted, '[role="button"]')[0]!.click();
		await settle();
		const clear = q(mounted, '[part="footer"] button');
		clear?.click();
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: null });
	});

	test('disabled hottexts are not focusable and ignore activation', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData(),
			disabled: true,
		});
		await settle();

		const target = qa(mounted, '[role="button"]')[0]!;
		expect(target.getAttribute('tabindex')).toBe('-1');
		target.click();
		pressKey(target, 'Enter');
		await settle();

		expect(mounted.instance.response).toBeUndefined();
		expect(mounted.events).toHaveLength(0);
	});

	test('multi-selection mode answers with the array of selected identifiers', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		const targets = qa(mounted, '[role="button"]');
		targets[0]!.click();
		targets[1]!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['H1', 'H2']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['H1', 'H2'] });

		// maxChoices caps further selection
		targets[2]!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'H2']);
	});
});
