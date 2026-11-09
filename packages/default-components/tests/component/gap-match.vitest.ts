import { afterEach, describe, expect, test } from 'vitest';
import GapMatchInteraction from '../../src/plugins/gap-match/GapMatchInteraction.svelte';
import type { GapMatchInteractionData } from '@pie-qti/item-player';
import {
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
} from './helpers';

function gapData(overrides: Partial<GapMatchInteractionData> = {}): GapMatchInteractionData {
	return {
		type: 'gapMatchInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		prompt: '<p>The sky is <gap identifier="G1"/> today.</p>',
		promptText: 'The sky is [GAP:G1] today.',
		gapTexts: [
			{ identifier: 'W1', text: 'blue', matchMax: 1 },
			{ identifier: 'W2', text: 'green', matchMax: 1 },
		],
		gaps: ['G1'],
		...overrides,
	};
}

afterEach(() => {
	// Remove any hosts appended during the test.
	for (const node of Array.from(document.body.children)) node.remove();
});

function liveRegion(mounted: { host: HTMLElement }): string {
	return q(mounted, '[aria-live="polite"]')?.textContent?.trim() ?? '';
}

describe('GapMatchInteraction (pie-qti-gap-match)', () => {
	test('renders the prompt exactly once, with live gap controls and no dead markers', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		const text = mounted.host.textContent ?? '';
		// The double-render regression: promptText renders once, and the static prompt with dead
		// `[GAP:...]` markers must not appear alongside it.
		expect(text.split('The sky is').length - 1).toBe(1);
		expect(text).not.toContain('[GAP:');

		const gap = q(mounted, 'button[data-gap-id="G1"]');
		expect(gap?.getAttribute('data-empty')).toBe('true');
		// Gaps are named with localized ordinals, never the raw QTI gap identifier,
		// which can leak the answer to screen reader users (WCAG 1.3.1/4.1.2).
		const label = gap?.getAttribute('aria-label') ?? '';
		expect(label).toContain('Blank 1 of 1');
		expect(label).not.toContain('G1');
		cleanupInteraction(mounted);
	});

	test('gap names use each gap’s reading-order position, not its identifier', async () => {
		const mounted = mountInteraction(GapMatchInteraction, {
			interaction: gapData({
				promptText: 'A [GAP:G2] b [GAP:G1] c.',
				gaps: ['G1', 'G2'],
			}),
		});
		await settle();

		expect(q(mounted, 'button[data-gap-id="G2"]')?.getAttribute('aria-label')).toContain('Blank 1 of 2');
		expect(q(mounted, 'button[data-gap-id="G1"]')?.getAttribute('aria-label')).toContain('Blank 2 of 2');
		cleanupInteraction(mounted);
	});

	test('pick-up flow: select a word, click a gap, pair is emitted and rendered', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		const word = q(mounted, 'button[data-word-id="W1"]');
		word?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(word?.getAttribute('aria-pressed')).toBe('true');

		const gap = q(mounted, 'button[data-gap-id="G1"]');
		gap?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toEqual(['W1 G1']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['W1 G1'] });
		expect(q(mounted, 'button[data-gap-id="G1"]')?.textContent).toBe('blue');
		cleanupInteraction(mounted);
	});

	test('placing a word announces it with the gap ordinal, not the gap identifier', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		q(mounted, 'button[data-word-id="W1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		q(mounted, 'button[data-gap-id="G1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(liveRegion(mounted)).toBe('Placed blue in blank 1 of 1.');
		cleanupInteraction(mounted);
	});

	test('Escape cancels a held word, announces the cancellation and refocuses the word', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		const word = q<HTMLButtonElement>(mounted, 'button[data-word-id="W1"]');
		word?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(word?.getAttribute('aria-pressed')).toBe('true');

		// Escape from a gap: pick-up is cancelled and focus returns to the held word.
		const gap = q<HTMLElement>(mounted, 'button[data-gap-id="G1"]');
		gap?.focus();
		pressKey(gap!, 'Escape');
		await settle();

		expect(q(mounted, 'button[data-word-id="W1"]')?.getAttribute('aria-pressed')).toBe('false');
		expect(liveRegion(mounted)).toBe('Pick-up of blue cancelled.');
		expect(document.activeElement).toBe(q(mounted, 'button[data-word-id="W1"]'));
		cleanupInteraction(mounted);
	});

	test('clicking a filled gap clears it and emits the emptied response', async () => {
		const mounted = mountInteraction(GapMatchInteraction, {
			interaction: gapData(),
			response: ['W1 G1'],
		});
		await settle();

		expect(q(mounted, 'button[data-gap-id="G1"]')?.textContent).toBe('blue');

		q(mounted, 'button[data-gap-id="G1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toEqual([]);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: [] });
		cleanupInteraction(mounted);
	});

	test('scorer role shows the correct answer inside the gap', async () => {
		const mounted = mountInteraction(GapMatchInteraction, {
			interaction: gapData(),
			role: 'scorer',
			correctResponse: ['W2 G1'],
		});
		await settle();

		const gap = q(mounted, 'button[data-gap-id="G1"]');
		expect(gap?.classList.contains('qti-gm-gap-correct')).toBe(true);
		expect(gap?.textContent).toBe('green');
		expect(gap?.getAttribute('aria-label')).toContain('Correct answer: green.');
		cleanupInteraction(mounted);
	});

	test('multiple gaps render in prompt order', async () => {
		const mounted = mountInteraction(GapMatchInteraction, {
			interaction: gapData({
				promptText: 'A [GAP:G1] b [GAP:G2] c.',
				gaps: ['G1', 'G2'],
			}),
		});
		await settle();

		const gaps = qa(mounted, 'button[data-gap-id]');
		expect(gaps.map((g) => g.getAttribute('data-gap-id'))).toEqual(['G1', 'G2']);
		cleanupInteraction(mounted);
	});

	describe('gapImg choices', () => {
		function imageGapData(overrides: Partial<GapMatchInteractionData> = {}): GapMatchInteractionData {
			return gapData({
				gapImages: [
					{
						identifier: 'IMG1',
						src: 'images/sun.png',
						alt: 'Sun icon',
						matchMax: 1,
					},
				],
				...overrides,
			});
		}

		test('image choices render as tiles named by their alt text', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: imageGapData() });
			await settle();

			const tile = q<HTMLButtonElement>(mounted, 'button[data-word-id="IMG1"]');
			expect(tile).not.toBeNull();
			expect(tile?.getAttribute('aria-label')).toBe('Sun icon');
			expect(tile?.querySelector('img')?.getAttribute('src')).toBe('images/sun.png');
			cleanupInteraction(mounted);
		});

		test('image choices participate in the pick-up flow like words', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: imageGapData() });
			await settle();

			q(mounted, 'button[data-word-id="IMG1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await settle();
			q(mounted, 'button[data-gap-id="G1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await settle();

			expect(mounted.instance.response).toEqual(['IMG1 G1']);
			expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['IMG1 G1'] });
			expect(q(mounted, 'button[data-gap-id="G1"]')?.getAttribute('aria-label')).toContain('filled with Sun icon');
			expect(q(mounted, 'button[data-gap-id="G1"] img')?.getAttribute('src')).toBe('images/sun.png');
			cleanupInteraction(mounted);
		});

		test('a placed image can be cleared from the palette', async () => {
			const mounted = mountInteraction(GapMatchInteraction, {
				interaction: imageGapData(),
				response: ['IMG1 G1'],
			});
			await settle();

			expect(q(mounted, 'button[data-gap-id="G1"] img')).not.toBeNull();
			q(mounted, 'button[data-gap-id="G1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await settle();
			expect(mounted.instance.response).toEqual([]);
			cleanupInteraction(mounted);
		});
	});

	describe('matchGroup (the rule response validation applies)', () => {
		const click = (element: Element | null) => element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		test('a held word marks the gaps its matchGroup does not name, and they refuse it', async () => {
			// QTI: a gapText's matchGroup lists the gaps it may be matched with, a gap's the words.
			// G2 names only W2, and W1 names only G1, so neither reading allows W1 in G2.
			const mounted = mountInteraction(GapMatchInteraction, {
				interaction: gapData({
					promptText: 'First [GAP:G1] then [GAP:G2].',
					gaps: ['G1', 'G2'],
					gapMatchGroups: { G2: ['W2'] },
					gapTexts: [
						{ identifier: 'W1', text: 'one', matchMax: 1, matchGroup: ['G1'] },
						{ identifier: 'W2', text: 'two', matchMax: 1 },
					],
				}),
			});
			await settle();

			click(q(mounted, 'button[data-word-id="W1"]'));
			await settle();
			const g1 = q(mounted, 'button[data-gap-id="G1"]');
			const g2 = q(mounted, 'button[data-gap-id="G2"]');
			expect(g1?.getAttribute('aria-disabled')).toBeNull();
			expect(g2?.getAttribute('aria-disabled')).toBe('true');
			expect(g2?.getAttribute('aria-label')).toContain('Not compatible with the selected word.');

			// Refused: no pair, the word stays held, and the refusal is announced.
			click(g2);
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(q(mounted, 'button[data-word-id="W1"]')?.getAttribute('aria-pressed')).toBe('true');
			expect(liveRegion(mounted)).toBe('Not compatible with the selected word.');

			click(g1);
			await settle();
			expect(mounted.instance.response).toEqual(['W1 G1']);
			cleanupInteraction(mounted);
		});

		test('a pointer drop onto a gap that refuses the word is ignored', async () => {
			const mounted = mountInteraction(GapMatchInteraction, {
				interaction: gapData({
					promptText: 'First [GAP:G1] then [GAP:G2].',
					gaps: ['G1', 'G2'],
					gapMatchGroups: { G2: ['W2'] },
					gapTexts: [
						{ identifier: 'W1', text: 'one', matchMax: 1, matchGroup: ['G1'] },
						{ identifier: 'W2', text: 'two', matchMax: 1 },
					],
				}),
			});
			await settle();

			const drop = new Event('drop', { bubbles: true, cancelable: true });
			Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'W1' } });
			q(mounted, 'button[data-gap-id="G2"]')?.dispatchEvent(drop);
			await settle();

			expect(mounted.events).toHaveLength(0);
			cleanupInteraction(mounted);
		});

		test('while a word is dragged, the gaps that refuse it are marked and do not accept the drag', async () => {
			const mounted = mountInteraction(GapMatchInteraction, {
				interaction: gapData({
					promptText: 'First [GAP:G1] then [GAP:G2].',
					gaps: ['G1', 'G2'],
					gapMatchGroups: { G2: ['W2'] },
					gapTexts: [
						{ identifier: 'W1', text: 'one', matchMax: 1, matchGroup: ['G1'] },
						{ identifier: 'W2', text: 'two', matchMax: 1 },
					],
				}),
			});
			await settle();

			const dragEvent = (type: string): Event => {
				const event = new Event(type, { bubbles: true, cancelable: true });
				Object.defineProperty(event, 'dataTransfer', {
					value: { setData: () => {}, getData: () => 'W1', effectAllowed: '', dropEffect: '' },
				});
				return event;
			};
			const word = q(mounted, 'button[data-word-id="W1"]');
			const g1 = q(mounted, 'button[data-gap-id="G1"]');
			const g2 = q(mounted, 'button[data-gap-id="G2"]');

			word?.dispatchEvent(dragEvent('dragstart'));
			await settle();
			expect(g2?.getAttribute('aria-disabled')).toBe('true');
			expect(g1?.getAttribute('aria-disabled')).toBeNull();

			// Not cancelling dragover is what tells the browser the drop is not allowed here.
			const overRefusing = dragEvent('dragover');
			g2?.dispatchEvent(overRefusing);
			expect(overRefusing.defaultPrevented).toBe(false);
			const overAccepting = dragEvent('dragover');
			g1?.dispatchEvent(overAccepting);
			expect(overAccepting.defaultPrevented).toBe(true);

			word?.dispatchEvent(dragEvent('dragend'));
			await settle();
			expect(g2?.getAttribute('aria-disabled')).toBeNull();
			expect(mounted.events).toHaveLength(0);
			cleanupInteraction(mounted);
		});

		test('the gap side constrains too: a gap accepts only the words its matchGroup names', async () => {
			// W3 names both gaps, but G2 names only W2, so W3 may not fill G2. The renderer used to
			// ignore a gap's matchGroup entirely.
			const mounted = mountInteraction(GapMatchInteraction, {
				interaction: gapData({
					promptText: 'First [GAP:G1] then [GAP:G2].',
					gaps: ['G1', 'G2'],
					gapMatchGroups: { G2: ['W2'] },
					gapTexts: [
						{ identifier: 'W2', text: 'two', matchMax: 1 },
						{ identifier: 'W3', text: 'three', matchMax: 1, matchGroup: ['G1', 'G2'] },
					],
				}),
			});
			await settle();

			click(q(mounted, 'button[data-word-id="W3"]'));
			await settle();
			expect(q(mounted, 'button[data-gap-id="G1"]')?.getAttribute('aria-disabled')).toBeNull();
			expect(q(mounted, 'button[data-gap-id="G2"]')?.getAttribute('aria-disabled')).toBe('true');
			cleanupInteraction(mounted);
		});

		test('words sharing a group label stay available after one is placed', async () => {
			// Response validation accepts both placements; the former renderer made W5 unavailable
			// as soon as W4 (same label) was placed.
			const mounted = mountInteraction(GapMatchInteraction, {
				interaction: gapData({
					promptText: 'First [GAP:G1] then [GAP:G2].',
					gaps: ['G1', 'G2'],
					gapTexts: [
						{ identifier: 'W4', text: 'four', matchMax: 1, matchGroup: ['set'] },
						{ identifier: 'W5', text: 'five', matchMax: 1, matchGroup: ['set'] },
					],
				}),
				response: ['W4 G1'],
			});
			await settle();

			const w5 = q(mounted, 'button[data-word-id="W5"]');
			expect(w5?.getAttribute('aria-disabled')).toBe('false');
			click(w5);
			await settle();
			click(q(mounted, 'button[data-gap-id="G2"]'));
			await settle();
			expect(mounted.instance.response).toEqual(['W4 G1', 'W5 G2']);
			cleanupInteraction(mounted);
		});
	});

	describe('maxAssociations cap (the limit response validation applies)', () => {
		const click = (element: Element | null) => element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const twoGaps = (overrides: Partial<GapMatchInteractionData> = {}) =>
			gapData({ promptText: 'A [GAP:G1] b [GAP:G2] c.', gaps: ['G1', 'G2'], ...overrides });
		async function place(mounted: { host: HTMLElement }, wordId: string, gapId: string) {
			click(q(mounted, `button[data-word-id="${wordId}"]`));
			await settle();
			click(q(mounted, `button[data-gap-id="${gapId}"]`));
			await settle();
		}

		test('a keyboard placement past the cap is refused, announced, and the word stays held', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: twoGaps({ maxAssociations: 1 }) });
			await settle();

			await place(mounted, 'W1', 'G1');
			expect(mounted.instance.response).toEqual(['W1 G1']);

			await place(mounted, 'W2', 'G2');
			expect(mounted.instance.response).toEqual(['W1 G1']);
			expect(liveRegion(mounted)).toBe('Association not possible: the limit of 1 is reached.');
			expect(q(mounted, 'button[data-word-id="W2"]')?.getAttribute('aria-pressed')).toBe('true');
			cleanupInteraction(mounted);
		});

		test('a pointer drop past the cap is refused and announced', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: twoGaps({ maxAssociations: 1 }) });
			await settle();
			await place(mounted, 'W1', 'G1');

			const drop = new Event('drop', { bubbles: true, cancelable: true });
			Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'W2' } });
			q(mounted, 'button[data-gap-id="G2"]')?.dispatchEvent(drop);
			await settle();

			expect(mounted.instance.response).toEqual(['W1 G1']);
			expect(liveRegion(mounted)).toBe('Association not possible: the limit of 1 is reached.');
			cleanupInteraction(mounted);
		});

		test('replacing the word in a filled gap stays within the cap', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: twoGaps({ maxAssociations: 1 }) });
			await settle();
			await place(mounted, 'W1', 'G1');

			await place(mounted, 'W2', 'G1');
			expect(mounted.instance.response).toEqual(['W2 G1']);
			cleanupInteraction(mounted);
		});

		test('the author’s data-max-selections-message is announced instead', async () => {
			const mounted = mountInteraction(GapMatchInteraction, {
				interaction: twoGaps({ maxAssociations: 1, maxSelectionsMessage: 'Only one word may be placed.' }),
			});
			await settle();
			await place(mounted, 'W1', 'G1');
			await place(mounted, 'W2', 'G2');

			expect(liveRegion(mounted)).toBe('Only one word may be placed.');
			cleanupInteraction(mounted);
		});

		test('maxAssociations=0 means unlimited: both words place', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: twoGaps({ maxAssociations: 0 }) });
			await settle();
			await place(mounted, 'W1', 'G1');
			await place(mounted, 'W2', 'G2');

			expect(mounted.instance.response).toEqual(['W1 G1', 'W2 G2']);
			cleanupInteraction(mounted);
		});
	});
});

describe('word removal (round 6)', () => {
	function clickWordAndGap(mounted: { host: HTMLElement }, wordId: string, gapId: string) {
		q(mounted, `button[data-word-id="${wordId}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		q(mounted, `button[data-gap-id="${gapId}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}

	test('removing a word from the blanks announces it and keeps focus on the word', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		// Place W1 into the gap, which shows its remove button.
		clickWordAndGap(mounted, 'W1', 'G1');
		await settle();
		const remove = q<HTMLButtonElement>(mounted, '[part="word-remove"]');
		expect(remove).not.toBeNull();

		remove.focus();
		remove.click();
		await settle();

		// The removal is announced; the remove button is gone; focus moved back to the
		// now-enabled word button instead of the document body.
		expect(liveRegion(mounted)).toBe('blue removed from the blanks.');
		expect(q(mounted, '[part="word-remove"]')).toBeNull();
		const word = q<HTMLButtonElement>(mounted, '[data-word-id="W1"]');
		expect(document.activeElement).toBe(word);
		expect(word?.disabled).toBe(false);
		cleanupInteraction(mounted);
	});
});
