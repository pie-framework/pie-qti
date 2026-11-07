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

		// An unpaired choice has no state sentence (Svelte prints a bare `false`).
		const unpaired = choiceButtons(mounted)[2]!;
		const emptyState = document.getElementById(unpaired.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '');
		expect(emptyState?.textContent?.trim()).toBe('');

		const remove = q<HTMLButtonElement>(mounted, '[part="pair-remove"]');
		expect(remove?.getAttribute('aria-label')).toBe('Remove association between Paris and France');

		remove?.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		cleanupInteraction(mounted);
	});

	test('the pair-remove control carries its own 44px sizing, not DaisyUI classes', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['A_cap A_country'],
		});
		await settle();

		const remove = q<HTMLButtonElement>(mounted, '[part="pair-remove"]')!;
		// Svelte injects the component stylesheet into the document head; assert the
		// shipped rule, since jsdom performs no layout.
		const styles = Array.from(document.querySelectorAll('style'), (style) => style.textContent ?? '').join('\n');
		expect(styles).toMatch(/\.qti-associate-pair-remove[^{]*\{/);
		expect(styles).toContain('inline-size: 44px');
		expect(styles).toContain('block-size: 44px');
		expect(remove.classList.contains('btn')).toBe(false);
		cleanupInteraction(mounted);
	});

	test('removing a pair keeps focus on the pair list, or returns it to the choices', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['A_cap A_country', 'B_cap B_country'],
		});
		await settle();

		const removes = qa<HTMLButtonElement>(mounted, '[part="pair-remove"]');
		expect(removes).toHaveLength(2);
		removes[0]!.focus();
		removes[0]!.click();
		await settle();

		// The pair that moved into row 0 (Rome – Italy) now holds focus.
		expect(mounted.instance.response).toEqual(['B_cap B_country']);
		expect(document.activeElement).toBe(q(mounted, '[part="pair-remove"]'));
		expect(q(mounted, '[part="pair-remove"]')?.getAttribute('aria-label')).toBe(
			'Remove association between Rome skyline and Italy',
		);

		// Removing the last pair sends focus back to the choices.
		q<HTMLButtonElement>(mounted, '[part="pair-remove"]')!.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		expect(document.activeElement).toBe(choiceButtons(mounted)[0]);
		cleanupInteraction(mounted);
	});

	test('two renderings of the same item keep their own helper ids', async () => {
		const first = mountInteraction(AssociateInteraction, { interaction: associateData() });
		const second = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
		for (const mounted of [first, second]) {
			const helper = q(mounted, '[part="helper"]')!;
			const describedBy = q(mounted, '[part="choice"]')?.getAttribute('aria-describedby') ?? '';
			expect(describedBy.split(/\s+/)).toContain(helper.id);
			expect(mounted.host.contains(document.getElementById(helper.id))).toBe(true);
		}
		cleanupInteraction(first, second);
	});

	test('choices never reference the helper while it is hidden for correct answers', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			role: 'scorer',
			correctResponse: ['A_cap A_country'],
		});
		await settle();

		expect(q(mounted, '[part="helper"]')).toBeNull();
		for (const button of choiceButtons(mounted)) {
			for (const id of (button.getAttribute('aria-describedby') ?? '').split(/\s+/)) {
				expect(document.getElementById(id)).not.toBeNull();
			}
		}
		cleanupInteraction(mounted);
	});
});
