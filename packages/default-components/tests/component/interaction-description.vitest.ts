import type { AssociateInteractionData, GapMatchInteractionData, MatchInteractionData } from '@pie-qti/item-player';
import { afterEach, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import GapMatchInteraction from '../../src/plugins/gap-match/GapMatchInteraction.svelte';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import { cleanupInteraction, mountInteraction, q, settle } from './helpers';

function associateData(description: string): AssociateInteractionData {
	return {
		type: 'associateInteraction',
		responseId: 'ASSOCIATE',
		shuffle: false,
		maxAssociations: 0,
		prompt: null,
		choices: [
			{ identifier: 'A', text: 'Paris', matchMax: 1 },
			{ identifier: 'B', text: 'France', matchMax: 1 },
		],
		accessibility: { label: 'Capitals', description },
	};
}

function matchData(description: string): MatchInteractionData {
	return {
		type: 'matchInteraction',
		responseId: 'MATCH',
		shuffle: false,
		maxAssociations: 1,
		prompt: null,
		sourceSet: [{ identifier: 'S', text: 'Fish', matchMax: 1 }],
		targetSet: [{ identifier: 'T', text: 'Sea', matchMax: 1 }],
		accessibility: { description },
	};
}

function gapMatchData(description: string): GapMatchInteractionData {
	return {
		type: 'gapMatchInteraction',
		responseId: 'GAPS',
		shuffle: false,
		prompt: null,
		promptText: 'The sky is [GAP:G1].',
		gapTexts: [{ identifier: 'W1', text: 'blue', matchMax: 1 }],
		gaps: ['G1'],
		accessibility: { description },
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

/** Ids that occur more than once in the document. */
function duplicateIds(): string[] {
	const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
	return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

/** The element an interaction root's aria-describedby resolves to, in the root's own tree. */
function description(root: Element | null): Element | null {
	if (!root) return null;
	const id = root.getAttribute('aria-describedby');
	return id ? (root.getRootNode() as Document | ShadowRoot).getElementById(id) : null;
}

function rootOf(mounted: { host: HTMLElement }): Element | null {
	return q(mounted, '[role="group"][aria-describedby]');
}

describe('interaction description ids are instance-unique', () => {
	test('two different interactions on one page (a composite item) each resolve to their own description', async () => {
		const associate = mountInteraction(AssociateInteraction, {
			interaction: associateData('Pair each capital with its country.'),
		});
		const match = mountInteraction(MatchInteraction, { interaction: matchData('Match each animal with its habitat.') });
		const gaps = mountInteraction(GapMatchInteraction, { interaction: gapMatchData('Fill the blank with a colour.') });
		await settle();

		expect(duplicateIds()).toEqual([]);
		for (const [mounted, text] of [
			[associate, 'Pair each capital with its country.'],
			[match, 'Match each animal with its habitat.'],
			[gaps, 'Fill the blank with a colour.'],
		] as const) {
			const target = description(rootOf(mounted));
			expect(mounted.host.contains(target)).toBe(true);
			expect(target?.textContent).toBe(text);
		}
		cleanupInteraction(associate, match, gaps);
	});

	test('two instances of the same interaction each resolve to their own description', async () => {
		// Two renderings of one item: each delivery carries its own interaction object.
		const first = mountInteraction(AssociateInteraction, { interaction: associateData('Pair each capital with its country.') });
		const second = mountInteraction(AssociateInteraction, { interaction: associateData('Pair each capital with its country.') });
		await settle();

		expect(duplicateIds()).toEqual([]);
		const firstTarget = description(rootOf(first));
		const secondTarget = description(rootOf(second));
		expect(first.host.contains(firstTarget)).toBe(true);
		expect(second.host.contains(secondTarget)).toBe(true);
		expect(firstTarget).not.toBe(secondTarget);
		cleanupInteraction(first, second);
	});

	test('an interaction given as a JSON string attribute keeps its reference and description in step', async () => {
		// The web component path: the attribute is parsed once per instance, and both the root's
		// aria-describedby and the hidden description read that same parsed object.
		const json = JSON.stringify(associateData('Pair each capital with its country.'));
		const first = mountInteraction(AssociateInteraction, { interaction: json });
		const second = mountInteraction(AssociateInteraction, { interaction: json });
		await settle();

		expect(duplicateIds()).toEqual([]);
		for (const mounted of [first, second]) {
			const target = description(rootOf(mounted));
			expect(mounted.host.contains(target)).toBe(true);
			expect(target?.textContent).toBe('Pair each capital with its country.');
		}
		cleanupInteraction(first, second);
	});

	test('the id stays put while the response changes', async () => {
		const mounted = mountInteraction(AssociateInteraction, { interaction: associateData('Pair them.') });
		await settle();
		const before = rootOf(mounted)?.getAttribute('aria-describedby');

		const [paris, france] = Array.from(mounted.host.querySelectorAll<HTMLButtonElement>('[part="choice"]'));
		paris!.click();
		await settle();
		france!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['A B']);
		expect(rootOf(mounted)?.getAttribute('aria-describedby')).toBe(before);
		expect(description(rootOf(mounted))?.textContent).toBe('Pair them.');
		cleanupInteraction(mounted);
	});
});
