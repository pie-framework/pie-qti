import { afterEach, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import type { AssociateInteractionData } from '@pie-qti/item-player';
import {
	cleanupInteraction,
	mountInteraction,
	qa,
	q,
	settle,
} from './helpers';

function associateData(overrides: Partial<AssociateInteractionData> = {}): AssociateInteractionData {
	return {
		type: 'associateInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		maxAssociations: 0,
		prompt: '<p>Pair each capital with its country.</p>',
		choices: [
			{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 1 },
			{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1 },
			{ identifier: 'B_cap', text: '<img src="rome.png" alt="Rome skyline">', matchMax: 1 },
			{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 1 },
		],
		...overrides,
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

function choiceButtons(mounted: { host: HTMLElement }): HTMLButtonElement[] {
	return qa<HTMLButtonElement>(mounted, '[part="choice"]');
}

describe('AssociateInteraction (pie-qti-associate)', () => {
	test('choices are named by their rendered rich content, never by identifier', async () => {
		const mounted = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();

		for (const button of choiceButtons(mounted)) {
			// Raw QTI identifiers can leak answers to screen reader users, so they
			// must not appear in the accessible name (WCAG 4.1.2).
			expect(button.hasAttribute('aria-label')).toBe(false);
			const named = document.getElementById(button.getAttribute('aria-labelledby') ?? '');
			expect(named?.textContent ?? '').not.toMatch(/A_cap|A_country|B_cap|B_country/);
		}

		// The image choice's alt participates in the name element.
		const imageChoice = choiceButtons(mounted)[2]!;
		const named = document.getElementById(imageChoice.getAttribute('aria-labelledby') ?? '');
		expect(named?.querySelector('img')?.getAttribute('alt')).toBe('Rome skyline');
		cleanupInteraction(mounted);
	});

	test('selecting two choices creates the pair and emits qti-change', async () => {
		const mounted = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();

		const buttons = choiceButtons(mounted);
		buttons[0].click();
		await settle();
		expect(buttons[0].getAttribute('aria-pressed')).toBe('true');

		buttons[1].click();
		await settle();

		expect(mounted.instance.response).toEqual(['A_cap A_country']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['A_cap A_country'] });
		cleanupInteraction(mounted);
	});

	test('paired choices expose the state sentence and a remove control named without identifiers', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['A_cap A_country'],
		});
		await settle();

		// The state sentence sits in the describedby target of the paired choice.
		const paired = choiceButtons(mounted)[0]!;
		const stateElement = document.getElementById(paired.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '');
		expect(stateElement?.textContent?.trim()).toBe('In an association.');

		const remove = q<HTMLButtonElement>(mounted, '[part="pair-remove"]');
		expect(remove?.getAttribute('aria-label')).toBe('Remove association between Paris and France');

		remove?.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		cleanupInteraction(mounted);
	});
});
