/**
 * Pair placement properties of the pairing interactions, held fixed while the directed-pair
 * placement moves into one helper.
 *
 * - Directed pairs (match, gap match, graphic gap match) are emitted "source target"; associate
 *   and graphic associate pair two choices in the order they were activated (their `pair`
 *   responses are unordered, so validation and the correct-answer view compare both orders).
 * - Gap match and graphic gap match hold one source per target. Gap match reuses a word below
 *   its matchMax and moves it at it; graphic gap match always moves a placed label (its palette
 *   retires a placed label), so a matchMax=1 label dropped from H1 onto H2 leaves exactly
 *   "L H2" — which the many-to-many `createOrUpdatePair` would not (it keeps "L H1").
 */
import type {
	AssociateInteractionData,
	GapMatchInteractionData,
	GraphicAssociateInteractionData,
	GraphicGapMatchInteractionData,
	MatchInteractionData,
} from '@pie-qti/item-player';
import { afterEach, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import GapMatchInteraction from '../../src/plugins/gap-match/GapMatchInteraction.svelte';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import { createOrUpdatePair } from '../../src/shared/utils/pairHelpers';
import { cleanupInteraction, type MountedInteraction, mountInteraction, pressKey, q, qa, settle } from './helpers';

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

type Mounted = MountedInteraction;

function click(element: Element | null | undefined): void {
	element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function responseOf(mounted: Mounted): string[] {
	const value = mounted.instance.response;
	return Array.isArray(value) ? [...(value as string[])] : [];
}

/** A drop carrying `id` as its drag data (gap match reads it from the event). */
function dropWith(target: Element, id: string): void {
	const drop = new Event('drop', { bubbles: true, cancelable: true });
	Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => id } });
	target.dispatchEvent(drop);
}

/** Deterministic PRNG (mulberry32), so a failing sequence replays from its seed. */
function random(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(next: () => number, values: readonly T[]): T {
	return values[Math.floor(next() * values.length)] as T;
}

function tokens(pair: string): [string, string] {
	const [first = '', second = ''] = pair.split(' ');
	return [first, second];
}

function countOf(pairs: readonly string[], id: string, side: 0 | 1 | 'either'): number {
	return pairs.filter((pair) => {
		const [first, second] = tokens(pair);
		return side === 'either' ? first === id || second === id : (side === 0 ? first : second) === id;
	}).length;
}

const SEEDS = [1, 7, 42];
const STEPS = 40;

describe('gap match placement', () => {
	const words = { W1: 1, W2: 2, W3: 0 } as const;
	const gaps = ['G1', 'G2', 'G3'] as const;
	function data(overrides: Partial<GapMatchInteractionData> = {}): GapMatchInteractionData {
		return {
			type: 'gapMatchInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			prompt: '<p>x</p>',
			promptText: 'A [GAP:G1] b [GAP:G2] c [GAP:G3].',
			gapTexts: Object.entries(words).map(([identifier, matchMax]) => ({ identifier, text: identifier.toLowerCase(), matchMax })),
			gaps: [...gaps],
			maxAssociations: 0,
			...overrides,
		};
	}
	const gap = (mounted: Mounted, id: string) => q<HTMLButtonElement>(mounted, `button[data-gap-id="${id}"]`)!;

	test('a matchMax=1 word dropped from G1 onto G2 moves: exactly "W1 G2"', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: data(), response: ['W1 G1'] });
		await settle();
		dropWith(gap(mounted, 'G2'), 'W1');
		await settle();
		expect(responseOf(mounted)).toEqual(['W1 G2']);
		cleanupInteraction(mounted);
	});

	test('below its matchMax a word is reused; at it, the word moves; matchMax=0 always reuses', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: data(), response: ['W2 G1'] });
		await settle();
		dropWith(gap(mounted, 'G2'), 'W2');
		await settle();
		expect(responseOf(mounted)).toEqual(['W2 G1', 'W2 G2']);
		dropWith(gap(mounted, 'G3'), 'W2');
		await settle();
		expect(responseOf(mounted)).toEqual(['W2 G3']);
		cleanupInteraction(mounted);

		const unlimited = mountInteraction(GapMatchInteraction, { interaction: data() });
		await settle();
		for (const id of gaps) {
			dropWith(gap(unlimited, id), 'W3');
			await settle();
		}
		expect(responseOf(unlimited)).toEqual(['W3 G1', 'W3 G2', 'W3 G3']);
		cleanupInteraction(unlimited);
	});

	test('a gap holds one word: placing another replaces it', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: data(), response: ['W1 G1', 'W3 G2'] });
		await settle();
		dropWith(gap(mounted, 'G1'), 'W2');
		await settle();
		expect(responseOf(mounted)).toEqual(['W3 G2', 'W2 G1']);
		cleanupInteraction(mounted);
	});

	for (const seed of SEEDS) {
		test(`random placements keep "word gap" order, one word per gap and each matchMax (seed ${seed})`, async () => {
			const next = random(seed);
			let changes = 0;
			const mounted = mountInteraction(GapMatchInteraction, { interaction: data() });
			await settle();
			const wordIds = Object.keys(words);
			for (let step = 0; step < STEPS; step++) {
				const before = responseOf(mounted);
				const held = q<HTMLButtonElement>(mounted, 'button[data-word-id][aria-pressed="true"]')?.dataset.wordId;
				const action = Math.floor(next() * 5);
				const w = pick(next, wordIds);
				const g = pick(next, gaps);
				if (action === 0) click(q(mounted, `button[data-word-id="${w}"]`));
				else if (action === 1) click(gap(mounted, g));
				else if (action === 2) dropWith(gap(mounted, g), w);
				else if (action === 3) click(q(mounted, `button[data-word-id="${w}"]`)?.parentElement?.querySelector('[part="word-remove"]'));
				else pressKey(gap(mounted, g), 'Escape');
				await settle();

				const after = responseOf(mounted);
				for (const pair of after) {
					const [source, target] = tokens(pair);
					expect(wordIds, `${pair} starts with a word`).toContain(source);
					expect(gaps, `${pair} ends with a gap`).toContain(target);
				}
				for (const id of gaps) expect(countOf(after, id, 1), `one word in ${id}`).toBeLessThanOrEqual(1);
				for (const [id, max] of Object.entries(words)) {
					if (max > 0) expect(countOf(after, id, 0), `${id} within matchMax`).toBeLessThanOrEqual(max);
				}
				const changed = JSON.stringify(after) !== JSON.stringify(before);
				if (changed) changes += 1;
				if (changed && action === 1 && held) expect(after).toContain(`${held} ${g}`);
				if (changed && action === 2) expect(after).toContain(`${w} ${g}`);
			}
			// The sequence exercised the placement: it is not a run of refusals.
			expect(changes).toBeGreaterThanOrEqual(8);
			cleanupInteraction(mounted);
		});
	}
});

describe('graphic gap match placement', () => {
	const labels = { A: 1, B: 2, C: 0 } as const;
	const hotspotIds = ['H1', 'H2', 'H3'] as const;
	function data(overrides: Partial<GraphicGapMatchInteractionData> = {}): GraphicGapMatchInteractionData {
		return {
			type: 'graphicGapMatchInteraction',
			responseId: 'RESPONSE',
			prompt: null,
			maxAssociations: 0,
			imageData: { type: 'image', src: 'map.png', width: '300', height: '100', alt: 'A map' },
			gapTexts: Object.entries(labels).map(([identifier, matchMax]) => ({ identifier, text: `Label ${identifier}`, matchMax })),
			gapImages: [],
			hotspots: hotspotIds.map((identifier, index) => ({
				identifier,
				shape: 'rect',
				coords: `${index * 100},0,${index * 100 + 90},90`,
				matchMax: 1,
			})),
			...overrides,
		};
	}
	const label = (mounted: Mounted, id: string) =>
		qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((b) => b.textContent?.trim() === `Label ${id}`)!;
	const hotspot = (mounted: Mounted, id: string) => qa<SVGElement>(mounted, '.qti-ggm-hotspot')[hotspotIds.indexOf(id as never)]!;
	async function drag(mounted: Mounted, labelId: string, hotspotId: string) {
		label(mounted, labelId).dispatchEvent(new Event('dragstart', { bubbles: true }));
		await settle();
		hotspot(mounted, hotspotId).dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		await settle();
	}

	test('a matchMax=1 label dropped from H1 onto H2 leaves exactly "L H2"', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: data() });
		await settle();
		pressKey(label(mounted, 'A'), 'Enter');
		await settle();
		pressKey(hotspot(mounted, 'H1'), 'Enter');
		await settle();
		expect(responseOf(mounted)).toEqual(['A H1']);

		await drag(mounted, 'A', 'H2');
		expect(responseOf(mounted)).toEqual(['A H2']);
		// The many-to-many helper would have kept the label on its old hotspot.
		expect(createOrUpdatePair(['A H1'], 'A', 'H2')).toEqual(['A H1', 'A H2']);
		cleanupInteraction(mounted);
	});

	test('a placed label always moves, whatever its matchMax', async () => {
		for (const id of ['B', 'C']) {
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: data(), response: [`${id} H1`] });
			await settle();
			await drag(mounted, id, 'H2');
			expect(responseOf(mounted)).toEqual([`${id} H2`]);
			cleanupInteraction(mounted);
		}
	});

	test('a hotspot holds one label: placing another replaces it', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: data(), response: ['A H1', 'C H3'] });
		await settle();
		await drag(mounted, 'B', 'H1');
		expect(responseOf(mounted)).toEqual(['C H3', 'B H1']);
		cleanupInteraction(mounted);
	});

	for (const seed of SEEDS) {
		test(`random placements keep "label hotspot" order and one pair per label and per hotspot (seed ${seed})`, async () => {
			const next = random(seed);
			let changes = 0;
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: data() });
			await settle();
			const labelIds = Object.keys(labels);
			for (let step = 0; step < STEPS; step++) {
				const before = responseOf(mounted);
				const held = labelIds.find((id) => label(mounted, id).getAttribute('aria-pressed') === 'true');
				const action = Math.floor(next() * 5);
				const l = pick(next, labelIds);
				const h = pick(next, hotspotIds);
				if (action === 0) pressKey(label(mounted, l), 'Enter');
				else if (action === 1) pressKey(hotspot(mounted, h), 'Enter');
				else if (action === 2) await drag(mounted, l, h);
				else if (action === 3) click(label(mounted, l).parentElement?.querySelector('[part="label-remove"]'));
				else pressKey(hotspot(mounted, h), 'Escape');
				await settle();

				const after = responseOf(mounted);
				for (const pair of after) {
					const [source, target] = tokens(pair);
					expect(labelIds, `${pair} starts with a label`).toContain(source);
					expect(hotspotIds, `${pair} ends with a hotspot`).toContain(target);
				}
				for (const id of hotspotIds) expect(countOf(after, id, 1), `one label on ${id}`).toBeLessThanOrEqual(1);
				for (const id of labelIds) expect(countOf(after, id, 0), `${id} placed once`).toBeLessThanOrEqual(1);
				const changed = JSON.stringify(after) !== JSON.stringify(before);
				if (changed) changes += 1;
				if (changed && action === 1 && held) expect(after).toContain(`${held} ${h}`);
				if (changed && action === 2) expect(after).toContain(`${l} ${h}`);
			}
			// The sequence exercised the placement: it is not a run of refusals.
			expect(changes).toBeGreaterThanOrEqual(8);
			cleanupInteraction(mounted);
		});
	}
});

describe('match placement', () => {
	const sources = { S1: 1, S2: 2, S3: 0 } as const;
	const targetIds = ['T1', 'T2', 'T3'] as const;
	function data(): MatchInteractionData {
		return {
			type: 'matchInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			maxAssociations: 0,
			prompt: null,
			sourceSet: Object.entries(sources).map(([identifier, matchMax]) => ({ identifier, text: `<p>${identifier}</p>`, matchMax })),
			targetSet: targetIds.map((identifier) => ({ identifier, text: `<p>${identifier}</p>`, matchMax: 1 })),
		};
	}

	for (const seed of SEEDS) {
		test(`random matches keep "source target" order, one source per target and each matchMax (seed ${seed})`, async () => {
			const next = random(seed);
			let changes = 0;
			const mounted = mountInteraction(MatchInteraction, { interaction: data() });
			await settle();
			const sourceIds = Object.keys(sources);
			const target = (id: string) => qa<HTMLButtonElement>(mounted, '[part="target"]')[targetIds.indexOf(id as never)]!;
			const source = (id: string) => q<HTMLButtonElement>(mounted, `[data-source-id="${id}"]`)!;
			for (let step = 0; step < STEPS; step++) {
				const before = responseOf(mounted);
				const held = q<HTMLButtonElement>(mounted, '[data-source-id][aria-pressed="true"]')?.dataset.sourceId;
				const action = Math.floor(next() * 5);
				const s = pick(next, sourceIds);
				const t = pick(next, targetIds);
				if (action === 0) click(source(s));
				else if (action === 1) click(target(t));
				else if (action === 2) {
					source(s).dispatchEvent(new Event('dragstart', { bubbles: true }));
					await settle();
					target(t).dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
				} else if (action === 3) click(source(s).parentElement?.querySelector('[part="source-clear"]'));
				else pressKey(source(s), 'Escape');
				await settle();

				const after = responseOf(mounted);
				for (const pair of after) {
					const [first, second] = tokens(pair);
					expect(sourceIds, `${pair} starts with a source`).toContain(first);
					expect(targetIds, `${pair} ends with a target`).toContain(second);
				}
				for (const id of targetIds) expect(countOf(after, id, 1), `one source on ${id}`).toBeLessThanOrEqual(1);
				for (const [id, max] of Object.entries(sources)) {
					if (max > 0) expect(countOf(after, id, 0), `${id} within matchMax`).toBeLessThanOrEqual(max);
				}
				const changed = JSON.stringify(after) !== JSON.stringify(before);
				if (changed) changes += 1;
				if (changed && action === 1 && held) expect(after).toContain(`${held} ${t}`);
				if (changed && action === 2) expect(after).toContain(`${s} ${t}`);
			}
			// The sequence exercised the placement: it is not a run of refusals.
			expect(changes).toBeGreaterThanOrEqual(8);
			cleanupInteraction(mounted);
		});
	}
});

describe('associate and graphic associate pairing order', () => {
	const capacities = { A: 2, B: 2, C: 0, D: 1 } as const;
	const ids = Object.keys(capacities);

	function associateData(): AssociateInteractionData {
		return {
			type: 'associateInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			maxAssociations: 0,
			prompt: null,
			choices: Object.entries(capacities).map(([identifier, matchMax]) => ({ identifier, text: `<p>${identifier}</p>`, matchMax })),
		};
	}
	function graphicData(): GraphicAssociateInteractionData {
		return {
			type: 'graphicAssociateInteraction',
			responseId: 'RESPONSE',
			prompt: null,
			maxAssociations: 0,
			minAssociations: 0,
			imageData: { type: 'svg', content: '<svg/>', width: '400', height: '50' },
			associableHotspots: Object.entries(capacities).map(([identifier, matchMax], index) => ({
				identifier,
				shape: 'rect',
				coords: `${index * 100},0,${index * 100 + 90},40`,
				matchMax,
				label: `Region ${identifier}`,
			})),
		};
	}

	const surfaces = [
		{ name: 'associate', component: AssociateInteraction, data: associateData, choice: '[part="choice"]', remove: '[part="pair-remove"]' },
		{ name: 'graphic associate', component: GraphicAssociateInteraction, data: graphicData, choice: 'button[part="hotspot"]', remove: '[part="association-remove"]' },
	] as const;

	for (const surface of surfaces) {
		for (const seed of SEEDS) {
			test(`${surface.name}: a pair is the first activated choice, then its partner; matchMax holds (seed ${seed})`, async () => {
				const next = random(seed);
				let pairsMade = 0;
				const mounted = mountInteraction(surface.component, { interaction: surface.data() });
				await settle();
				const choices = () => qa<HTMLButtonElement>(mounted, surface.choice);
				for (let step = 0; step < STEPS; step++) {
					const before = responseOf(mounted);
					const selectedIndex = choices().findIndex((button) => button.getAttribute('aria-pressed') === 'true');
					const index = Math.floor(next() * ids.length);
					const removing = next() < 0.2;
					if (removing) click(pick(next, qa(mounted, surface.remove)));
					else click(choices()[index]);
					await settle();

					const after = responseOf(mounted);
					for (const pair of after) {
						const [first, second] = tokens(pair);
						expect(ids, `${pair} pairs choices`).toContain(first);
						expect(ids, `${pair} pairs choices`).toContain(second);
						expect(first, `${pair} pairs two choices`).not.toBe(second);
					}
					for (const [id, max] of Object.entries(capacities)) {
						if (max > 0) expect(countOf(after, id, 'either'), `${id} within matchMax`).toBeLessThanOrEqual(max);
					}
					if (!removing && after.length > before.length) {
						pairsMade += 1;
						expect(selectedIndex).toBeGreaterThanOrEqual(0);
						expect(after.at(-1)).toBe(`${ids[selectedIndex]} ${ids[index]}`);
					}
				}
				// The sequence exercised the pairing: it is not a run of refusals.
				expect(pairsMade).toBeGreaterThanOrEqual(3);
				cleanupInteraction(mounted);
			});
		}
	}
});
