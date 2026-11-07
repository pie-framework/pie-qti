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
		gaps: [{ identifier: 'G1', index: 0 }],
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
				gaps: [
					{ identifier: 'G1', index: 0 },
					{ identifier: 'G2', index: 1 },
				],
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
				gaps: [
					{ identifier: 'G1', index: 0 },
					{ identifier: 'G2', index: 1 },
				],
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
});
