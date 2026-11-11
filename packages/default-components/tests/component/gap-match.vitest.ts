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

	test('an alt-less gap image is named by a localized ordinal, never its identifier', async () => {
		const mounted = mountInteraction(GapMatchInteraction, {
			interaction: gapData({
				gapImages: [
					{ identifier: 'SECRET_KEY', src: 'x.png', alt: '', matchMax: 1 },
					{ identifier: 'europe', src: 'europe.png', alt: 'Map of Europe', matchMax: 1 },
				],
			}),
		});
		await settle();

		// The image has no alt: the tile still carries a non-empty name, and it is the
		// tile's presented position in the palette (after the two gap texts) — not the
		// identifier, which can leak the answer key to screen reader users (WCAG 4.1.2).
		const textless = q(mounted, 'button[data-word-id="SECRET_KEY"]')!;
		expect(textless.getAttribute('aria-label')).toBe('Choice 3');

		// An authored alt still wins.
		expect(q(mounted, 'button[data-word-id="europe"]')?.getAttribute('aria-label')).toBe('Map of Europe');

		// Pick-up and placement announcements use the same name.
		textless.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(liveRegion(mounted)).toBe('Choice 3 picked up. Select a blank to place it, or press Escape to cancel.');

		q(mounted, 'button[data-gap-id="G1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['SECRET_KEY G1']);
		expect(q(mounted, 'button[data-gap-id="G1"]')?.getAttribute('aria-label')).toContain(
			'Blank 1 of 1, filled with Choice 3',
		);
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

		test('two identical refusals in a row both reach the live region (WCAG 4.1.3)', async () => {
			// A live region announces a change of its text: the same refusal twice must still
			// change the region a second time, or assistive technology stays silent then.
			const mounted = mountInteraction(GapMatchInteraction, { interaction: twoGaps({ maxAssociations: 1 }) });
			await settle();
			await place(mounted, 'W1', 'G1');

			const dropW2OnG2 = (): Event => {
				const drop = new Event('drop', { bubbles: true, cancelable: true });
				Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'W2' } });
				return drop;
			};
			q(mounted, 'button[data-gap-id="G2"]')?.dispatchEvent(dropW2OnG2());
			await settle();
			const firstRefusal = liveRegion(mounted);
			expect(firstRefusal).toBe('Association not possible: the limit of 1 is reached.');

			q(mounted, 'button[data-gap-id="G2"]')?.dispatchEvent(dropW2OnG2());
			await settle();
			// The same sentence again: the region still carries it (invisible repeats are
			// silent to reading, marked by the shared announcer's zero-width space) and its
			// text has changed, so the second refusal is announced too.
			expect(liveRegion(mounted).replace(/\u200b/g, '')).toBe(firstRefusal);
			expect(liveRegion(mounted)).not.toBe(firstRefusal);
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

	// gap `required` (QTI 2.1 gap; QTI 3.0 §5.55.5): a valid response fills every required gap,
	// which response validation enforces. The candidate is told which gaps those are (WCAG 3.3.2).
	describe('required gaps', () => {
		const click = (element: Element | null) => element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const requiredFirst = () =>
			gapData({ promptText: 'A [GAP:G1] b [GAP:G2] c.', gaps: ['G1', 'G2'], requiredGaps: ['G1'] });

		/** The text of the elements an element's aria-describedby names, in order. */
		function description(element: Element | null): string {
			return (element?.getAttribute('aria-describedby') ?? '')
				.split(/\s+/)
				.filter(Boolean)
				.map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
				.join(' ');
		}

		test('a required gap carries a visible mark that is a character, not only a colour', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: requiredFirst() });
			await settle();

			const required = q(mounted, 'button[data-gap-id="G1"]');
			const optional = q(mounted, 'button[data-gap-id="G2"]');
			expect(required?.getAttribute('data-required')).toBe('true');
			expect(optional?.hasAttribute('data-required')).toBe(false);
			// The mark is visible text in the gap; it is hidden from assistive technology,
			// which hears the requirement from the description instead.
			const mark = required?.querySelector('.qti-gm-gap-required-mark');
			expect(mark?.textContent).toBe('*');
			expect(mark?.getAttribute('aria-hidden')).toBe('true');
			expect(optional?.querySelector('.qti-gm-gap-required-mark')).toBeNull();
			// A visible legend says what the mark means.
			expect(q(mounted, '[part="required-legend"]')?.textContent?.trim()).toBe('Blanks marked * are required.');
			cleanupInteraction(mounted);
		});

		test('a required gap states the requirement in its description: a button cannot be aria-required', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: requiredFirst() });
			await settle();

			const required = q(mounted, 'button[data-gap-id="G1"]');
			const optional = q(mounted, 'button[data-gap-id="G2"]');
			// aria-required is not allowed on role=button, so the description carries it.
			expect(required?.hasAttribute('aria-required')).toBe(false);
			expect(description(required)).toBe('Required.');
			expect(optional?.hasAttribute('aria-describedby')).toBe(false);
			// The name stays the gap's own (its ordinal and state), never the identifier.
			expect(required?.getAttribute('aria-label')).toBe('Blank 1 of 2. Drop an answer here.');
			cleanupInteraction(mounted);
		});

		test('a filled required gap stays marked and described', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: requiredFirst() });
			await settle();

			click(q(mounted, 'button[data-word-id="W1"]'));
			await settle();
			click(q(mounted, 'button[data-gap-id="G1"]'));
			await settle();

			const required = q(mounted, 'button[data-gap-id="G1"]');
			expect(mounted.instance.response).toEqual(['W1 G1']);
			expect(required?.getAttribute('data-required')).toBe('true');
			expect(required?.querySelector('.qti-gm-gap-required-mark')?.textContent).toBe('*');
			expect(description(required)).toBe('Required.');
			cleanupInteraction(mounted);
		});

		test('without required gaps there is no mark, legend or description', async () => {
			const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
			await settle();

			expect(q(mounted, '[data-required]')).toBeNull();
			expect(q(mounted, '.qti-gm-gap-required-mark')).toBeNull();
			expect(q(mounted, '[part="required-legend"]')).toBeNull();
			expect(q(mounted, 'button[data-gap-id="G1"]')?.hasAttribute('aria-describedby')).toBe(false);
			cleanupInteraction(mounted);
		});

		test('the legend and the description are localized', async () => {
			const messages: Record<string, string> = {
				'interactions.gapMatch.requiredBlanksLegend': 'Lege plekken met een * zijn verplicht.',
				'common.required': 'Verplicht',
			};
			const i18n = {
				getLocale: () => 'nl',
				setLocale: () => {},
				t: (key: string, fallback?: unknown, values?: Record<string, unknown>) => {
					const message = messages[key] ?? (typeof fallback === 'string' ? fallback : key);
					return message.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ''));
				},
			};
			const mounted = mountInteraction(GapMatchInteraction, { interaction: requiredFirst(), i18n });
			await settle();

			expect(q(mounted, '[part="required-legend"]')?.textContent?.trim()).toBe('Lege plekken met een * zijn verplicht.');
			expect(description(q(mounted, 'button[data-gap-id="G1"]'))).toBe('Verplicht.');
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

// createInteractionShell's rule: correct-answer mode is the scorer's view of an item that has a
// correct response. Hosts pass null when the item declares none; a scorer then sees the
// interaction as a candidate does. Only `disabled` stops interaction.
describe('GapMatchInteraction correct-answer mode: role × correct response', () => {
	const click = (element: Element | null) => element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

	test.each([
		['candidate', ['W2 G1'], false],
		['candidate', null, false],
		['scorer', ['W2 G1'], true],
		['scorer', null, false],
	] as const)('%s, correct response %j: correct-answer mode is %s, and placing emits', async (role, correctResponse, correctMode) => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData(), role, correctResponse });
		await settle();

		const gap = q(mounted, 'button[data-gap-id="G1"]');
		expect(gap?.classList.contains('qti-gm-gap-correct')).toBe(correctMode);
		expect(gap?.textContent).toBe(correctMode ? 'green' : '');
		expect((gap?.getAttribute('aria-label') ?? '').includes('Correct answer')).toBe(correctMode);

		click(q(mounted, 'button[data-word-id="W1"]'));
		await settle();
		click(q(mounted, 'button[data-gap-id="G1"]'));
		await settle();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['W1 G1'] });
		cleanupInteraction(mounted);
	});

	test('disabled stops placement for a scorer without a correct response too', async () => {
		const mounted = mountInteraction(GapMatchInteraction, {
			interaction: gapData(),
			role: 'scorer',
			correctResponse: null,
			disabled: true,
		});
		await settle();

		click(q(mounted, 'button[data-word-id="W1"]'));
		await settle();
		click(q(mounted, 'button[data-gap-id="G1"]'));
		await settle();
		expect(mounted.events).toHaveLength(0);
		cleanupInteraction(mounted);
	});
});
