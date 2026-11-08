import { afterEach, describe, expect, test } from 'vitest';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import MatchDragDrop from '../../src/shared/components/MatchDragDrop.svelte';
import type { MatchInteractionData } from '@pie-qti/item-player';
import {
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
} from './helpers';

function matchData(overrides: Partial<MatchInteractionData> = {}): MatchInteractionData {
	return {
		type: 'matchInteraction',
		responseId: 'MATCH',
		shuffle: false,
		maxAssociations: 2,
		prompt: '<p>Match each capital with its country.</p>',
		sourceSet: [
			{ identifier: 'paris', text: '<p>Paris</p>', matchMax: 1 },
			{ identifier: 'rome', text: '<p>Rome</p>', matchMax: 1 },
		],
		targetSet: [
			{ identifier: 'france', text: '<p>France</p>', matchMax: 1 },
			{ identifier: 'italy', text: '<p>Italy</p>', matchMax: 1 },
		],
		...overrides,
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

function namedElement(mounted: { host: HTMLElement }, selector: string, attribute: string): Element | null {
	const ref = q(mounted, selector)?.getAttribute(attribute);
	return ref ? document.getElementById(ref) : null;
}

function liveRegion(mounted: { host: HTMLElement }): string {
	return q(mounted, '[aria-live="polite"]')?.textContent?.trim() ?? '';
}

describe('MatchInteraction (pie-qti-match)', () => {
	test('sources and targets are named by their rendered rich content', async () => {
		const mounted = mountInteraction(MatchInteraction, {
			interaction: matchData({
				sourceSet: [{ identifier: 'paris', text: '<img src="paris.png" alt="Paris skyline">', matchMax: 1 }],
				targetSet: [{ identifier: 'france', text: '<math alttext="France"><mi>F</mi></math>', matchMax: 1 }],
			}),
		});
		await settle();

		const source = q(mounted, '[data-source-id="paris"]');
		expect(source?.hasAttribute('aria-label')).toBe(false);
		const sourceName = namedElement(mounted, '[data-source-id="paris"]', 'aria-labelledby');
		// The image's alt participates in the name; no "Item"/identifier placeholder.
		expect(sourceName?.querySelector('img')?.getAttribute('alt')).toBe('Paris skyline');

		const target = q(mounted, '[part="target"]');
		expect(target?.hasAttribute('aria-label')).toBe(false);
		const targetName = namedElement(mounted, '[part="target"]', 'aria-labelledby');
		// MathML alttext survives into the name instead of flattening to "F".
		expect(targetName?.querySelector('math')?.getAttribute('alttext')).toBe('France');
		cleanupInteraction(mounted);
	});

	test('state sentences live in the aria-describedby target, not the name', async () => {
		const mounted = mountInteraction(MatchInteraction, {
			interaction: matchData(),
			response: ['paris france'],
		});
		await settle();

		const sourceState = namedElement(mounted, '[data-source-id="paris"]', 'aria-describedby');
		expect(sourceState?.textContent?.trim()).toBe('Matched with France.');

		const targetState = namedElement(mounted, '[part="target"]', 'aria-describedby');
		expect(targetState?.textContent?.trim()).toBe('Matched with Paris.');
		cleanupInteraction(mounted);
	});

	test('selecting a source and a target creates the pair and emits qti-change', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData() });
		await settle();

		q<HTMLButtonElement>(mounted, '[data-source-id="paris"]')?.click();
		await settle();
		expect(q(mounted, '[data-source-id="paris"]')?.getAttribute('aria-pressed')).toBe('true');

		q<HTMLButtonElement>(mounted, '[part="target"]')?.click();
		await settle();

		expect(mounted.instance.response).toEqual(['paris france']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'MATCH', value: ['paris france'] });
		expect(liveRegion(mounted)).toBe('Paris matched with France.');
		// Focus returns to the source after the match (targets disable again).
		expect(document.activeElement).toBe(q(mounted, '[data-source-id="paris"]'));
		cleanupInteraction(mounted);
	});

	test('matchGroup names partner identifiers: only the named target accepts the source', async () => {
		// QTI 2.2/3.0: a source's matchGroup lists the target identifiers it may pair with. The
		// former label-only rule blocked paris–france ([france] and [paris] share no token) and
		// would let this through.
		const mounted = mountInteraction(MatchInteraction, {
			interaction: matchData({
				sourceSet: [
					{ identifier: 'paris', text: '<p>Paris</p>', matchMax: 1, matchGroup: ['france'] },
					{ identifier: 'rome', text: '<p>Rome</p>', matchMax: 1 },
				],
				targetSet: [
					{ identifier: 'france', text: '<p>France</p>', matchMax: 1, matchGroup: ['paris'] },
					{ identifier: 'italy', text: '<p>Italy</p>', matchMax: 1, matchGroup: ['rome'] },
				],
			}),
		});
		await settle();

		q<HTMLButtonElement>(mounted, '[data-source-id="paris"]')?.click();
		await settle();
		const [france, italy] = qa<HTMLButtonElement>(mounted, '[part="target"]');
		expect(france!.getAttribute('aria-disabled')).toBeNull();
		expect(italy!.getAttribute('aria-disabled')).toBe('true');

		italy!.click();
		await settle();
		expect(mounted.events).toHaveLength(0);

		france!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['paris france']);
		cleanupInteraction(mounted);
	});

	test('Escape cancels a selected source, announces it and returns focus to the source', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData() });
		await settle();

		const source = q<HTMLButtonElement>(mounted, '[data-source-id="rome"]');
		source?.click();
		await settle();
		expect(source?.getAttribute('aria-pressed')).toBe('true');

		const target = q<HTMLElement>(mounted, '[part="target"]');
		target?.focus();
		pressKey(target!, 'Escape');
		await settle();

		expect(q(mounted, '[data-source-id="rome"]')?.getAttribute('aria-pressed')).toBe('false');
		expect(liveRegion(mounted)).toBe('Selection of Rome cancelled.');
		expect(document.activeElement).toBe(q(mounted, '[data-source-id="rome"]'));
		cleanupInteraction(mounted);
	});

	test('the clear button names its source and stays a large touch target', async () => {
		const mounted = mountInteraction(MatchInteraction, {
			interaction: matchData(),
			response: ['paris france'],
		});
		await settle();

		const clear = q<HTMLButtonElement>(mounted, '[part="source-clear"]');
		expect(clear?.getAttribute('aria-label')).toBe('Clear match for Paris');
		// Sized in CSS via .qti-match-clear at 2.75rem (44px); the part hook keeps
		// it targetable. Assert the class that carries the size is present.
		expect(clear?.classList.contains('qti-match-clear')).toBe(true);

		clear?.focus();
		clear?.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		expect(liveRegion(mounted)).toBe('Match cleared for Paris');
		// The clear button removed itself with the match: focus lands on the
		// now-enabled source button, not on the document body (round 6).
		const source = q<HTMLButtonElement>(mounted, '[data-source-id="paris"]');
		expect(document.activeElement).toBe(source);
		expect(source?.disabled).toBe(false);
		cleanupInteraction(mounted);
	});

	test('an empty target advertises availability through its description', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData() });
		await settle();

		const states = qa(mounted, '[part="target"]').map(
			(target) => document.getElementById(target.getAttribute('aria-describedby') ?? '')?.textContent?.trim(),
		);
		expect(states).toEqual(['Available for matching.', 'Available for matching.']);
		cleanupInteraction(mounted);
	});

	test('two renderings of the same item name their structured group by their own prompt', async () => {
		// Same responseId twice (e.g. a review pane beside the live item): the
		// prompt id must come from the component instance, not from the item.
		const first = mountInteraction(MatchInteraction, { interaction: matchData(), structuredLabelSupport: true });
		const second = mountInteraction(MatchInteraction, { interaction: matchData(), structuredLabelSupport: true });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
		for (const mounted of [first, second]) {
			const group = q(mounted, '.qti-match-interaction');
			expect(group?.getAttribute('role')).toBe('group');
			const prompt = document.getElementById(group?.getAttribute('aria-labelledby') ?? '');
			expect(prompt?.getAttribute('part')).toBe('prompt');
			expect(mounted.host.contains(prompt)).toBe(true);
			expect(prompt?.textContent?.trim()).toBe('Match each capital with its country.');
		}
		cleanupInteraction(first, second);
	});
});

describe('MatchDragDrop instance-unique ids', () => {
	/** Ids that occur more than once in the document. */
	function duplicateIds(): string[] {
		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
	}

	test('two instances keep their own headings, instructions and state ids, also with structured labels', async () => {
		const data = matchData();
		const props = {
			sourceSet: data.sourceSet,
			targetSet: data.targetSet,
			pairs: ['paris france'],
			structuredLabels: true,
			onPairsChange: () => {},
		};
		const first = mountInteraction(MatchDragDrop, props);
		const second = mountInteraction(MatchDragDrop, props);
		await settle();

		expect(duplicateIds()).toEqual([]);
		for (const mounted of [first, second]) {
			// Structured labels name each column by its own visible heading.
			for (const [column, heading] of [
				['source-column', 'Source items to match'],
				['target-column', 'Target items for matching'],
			] as const) {
				const named = namedElement(mounted, `[part="${column}"]`, 'aria-labelledby');
				expect(named?.tagName).toBe('H3');
				expect(named?.textContent?.trim()).toBe(heading);
				expect(mounted.host.contains(named)).toBe(true);
			}
			const instructions = namedElement(mounted, '[part="grid"]', 'aria-describedby');
			expect(mounted.host.contains(instructions)).toBe(true);
			expect(instructions?.textContent).toContain('Press Space or Enter to select a source item.');
			// The rendered sr-only state sentence pairs with its own button.
			const sourceState = namedElement(mounted, '[data-source-id="paris"]', 'aria-describedby');
			expect(mounted.host.contains(sourceState)).toBe(true);
			expect(sourceState?.textContent?.trim()).toBe('Matched with France.');
		}
		cleanupInteraction(first, second);
	});
});
