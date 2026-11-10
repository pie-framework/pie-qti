/**
 * Pins of the pick-up/place flow the four drag-and-drop surfaces share — gap match, graphic gap
 * match, match (MatchDragDrop) and the sortable list: what is held, how a second activation, a
 * switch, a refusal or Escape changes it, what is announced and where focus goes. They hold the
 * behaviour fixed while the flow moves into one controller.
 */
import type { GapMatchInteractionData, GraphicGapMatchInteractionData, MatchInteractionData } from '@pie-qti/item-player';
import { afterEach, describe, expect, test } from 'vitest';
import GapMatchInteraction from '../../src/plugins/gap-match/GapMatchInteraction.svelte';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import SortableList from '../../src/shared/components/SortableList.svelte';
import { cleanupInteraction, mountInteraction, qa, q, settle } from './helpers';

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

function live(mounted: { host: HTMLElement }): string {
	return q(mounted, '[aria-live="polite"]')?.textContent?.trim() ?? '';
}

function click(element: Element | null | undefined): void {
	element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** Press a key with a real, cancelable KeyboardEvent and return it, to read `defaultPrevented`. */
function key(target: Element, name: string): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

describe('gap match pick-up/place', () => {
	function gapData(overrides: Partial<GapMatchInteractionData> = {}): GapMatchInteractionData {
		return {
			type: 'gapMatchInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			prompt: '<p>A <gap identifier="G1"/> b <gap identifier="G2"/> c.</p>',
			promptText: 'A [GAP:G1] b [GAP:G2] c.',
			gapTexts: [
				{ identifier: 'W1', text: 'blue', matchMax: 1 },
				{ identifier: 'W2', text: 'green', matchMax: 1 },
			],
			gaps: ['G1', 'G2'],
			...overrides,
		};
	}
	const word = (mounted: { host: HTMLElement }, id: string) => q<HTMLButtonElement>(mounted, `button[data-word-id="${id}"]`)!;
	const gap = (mounted: { host: HTMLElement }, id: string) => q<HTMLButtonElement>(mounted, `button[data-gap-id="${id}"]`)!;

	test('activating the held word again puts it down, announced', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		click(word(mounted, 'W1'));
		await settle();
		expect(word(mounted, 'W1').getAttribute('aria-pressed')).toBe('true');
		expect(word(mounted, 'W1').classList.contains('qti-gm-word-held')).toBe(true);
		expect(live(mounted)).toBe('blue picked up. Select a blank to place it, or press Escape to cancel.');

		click(word(mounted, 'W1'));
		await settle();
		expect(word(mounted, 'W1').getAttribute('aria-pressed')).toBe('false');
		expect(word(mounted, 'W1').classList.contains('qti-gm-word-held')).toBe(false);
		expect(live(mounted)).toBe('Pick-up of blue cancelled.');
		expect(mounted.events).toHaveLength(0);
		cleanupInteraction(mounted);
	});

	test('activating another word switches the held word', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		click(word(mounted, 'W1'));
		await settle();
		click(word(mounted, 'W2'));
		await settle();
		expect(word(mounted, 'W1').getAttribute('aria-pressed')).toBe('false');
		expect(word(mounted, 'W2').getAttribute('aria-pressed')).toBe('true');
		expect(live(mounted)).toBe('green picked up. Select a blank to place it, or press Escape to cancel.');
		cleanupInteraction(mounted);
	});

	test('while a word is held every accepting gap is ready and names the word; placing puts it down', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData(), response: ['W1 G1'] });
		await settle();

		expect(gap(mounted, 'G2').classList.contains('qti-gm-gap-ready')).toBe(false);
		click(word(mounted, 'W2'));
		await settle();
		expect(gap(mounted, 'G1').classList.contains('qti-gm-gap-ready')).toBe(true);
		expect(gap(mounted, 'G2').classList.contains('qti-gm-gap-ready')).toBe(true);
		expect(gap(mounted, 'G1').getAttribute('aria-label')).toBe('Blank 1 of 2, filled with blue. Select to replace with green.');
		expect(gap(mounted, 'G2').getAttribute('aria-label')).toBe('Blank 2 of 2. Select to place green here.');

		// Focus stays on the gap the word went into.
		gap(mounted, 'G2').focus();
		click(gap(mounted, 'G2'));
		await settle();
		expect(mounted.instance.response).toEqual(['W1 G1', 'W2 G2']);
		expect(live(mounted)).toBe('Placed green in blank 2 of 2.');
		expect(word(mounted, 'W2').getAttribute('aria-pressed')).toBe('false');
		expect(gap(mounted, 'G2').classList.contains('qti-gm-gap-ready')).toBe(false);
		expect(document.activeElement).toBe(gap(mounted, 'G2'));
		expect(gap(mounted, 'G2').getAttribute('aria-label')).toBe('Blank 2 of 2, filled with green. Select to clear.');
		cleanupInteraction(mounted);
	});

	test('a word at its matchMax cannot be picked up', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData(), response: ['W1 G1'] });
		await settle();

		expect(word(mounted, 'W1').disabled).toBe(true);
		click(word(mounted, 'W1'));
		await settle();
		expect(word(mounted, 'W1').getAttribute('aria-pressed')).toBe('false');
		expect(live(mounted)).toBe('');
		cleanupInteraction(mounted);
	});

	test('Escape puts the held word down without preventing the default; nothing held, Escape does nothing', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		const idle = key(gap(mounted, 'G1'), 'Escape');
		await settle();
		expect(idle.defaultPrevented).toBe(false);
		expect(live(mounted)).toBe('');

		click(word(mounted, 'W2'));
		await settle();
		const cancel = key(gap(mounted, 'G1'), 'Escape');
		await settle();
		expect(cancel.defaultPrevented).toBe(false);
		expect(word(mounted, 'W2').getAttribute('aria-pressed')).toBe('false');
		expect(live(mounted)).toBe('Pick-up of green cancelled.');
		expect(document.activeElement).toBe(word(mounted, 'W2'));
		cleanupInteraction(mounted);
	});

	test('a drop or the end of a drag clears the dragged word: no gap stays marked', async () => {
		const grouped = gapData({
			gapMatchGroups: { G2: ['W2'] },
			gapTexts: [
				{ identifier: 'W1', text: 'blue', matchMax: 1, matchGroup: ['G1'] },
				{ identifier: 'W2', text: 'green', matchMax: 1 },
			],
		});
		const mounted = mountInteraction(GapMatchInteraction, { interaction: grouped });
		await settle();

		const dragStart = () => {
			const start = new Event('dragstart', { bubbles: true });
			Object.defineProperty(start, 'dataTransfer', { value: { setData: () => {}, effectAllowed: 'none' } });
			word(mounted, 'W1').dispatchEvent(start);
		};
		dragStart();
		await settle();
		expect(gap(mounted, 'G2').getAttribute('aria-disabled')).toBe('true');
		word(mounted, 'W1').dispatchEvent(new Event('dragend', { bubbles: true }));
		await settle();
		expect(gap(mounted, 'G2').getAttribute('aria-disabled')).toBeNull();

		dragStart();
		await settle();
		const drop = new Event('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'W1' } });
		gap(mounted, 'G1').dispatchEvent(drop);
		await settle();
		expect(mounted.instance.response).toEqual(['W1 G1']);
		expect(gap(mounted, 'G2').getAttribute('aria-disabled')).toBeNull();
		cleanupInteraction(mounted);
	});
});

describe('graphic gap match pick-up/place', () => {
	function ggmData(overrides: Partial<GraphicGapMatchInteractionData> = {}): GraphicGapMatchInteractionData {
		return {
			type: 'graphicGapMatchInteraction',
			responseId: 'RESPONSE',
			prompt: null,
			maxAssociations: 0,
			imageData: { type: 'image', src: 'lake.png', width: '400', height: '200', alt: 'A lake' },
			gapTexts: [
				{ identifier: 'RAIN', text: 'Rain', matchMax: 1 },
				{ identifier: 'SUN', text: 'Sun', matchMax: 1 },
			],
			gapImages: [],
			hotspots: [
				{ identifier: 'SKY', shape: 'circle', coords: '300,50,8', matchMax: 1 },
				{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1 },
			],
			...overrides,
		};
	}
	const label = (mounted: { host: HTMLElement }, text: string) =>
		qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((b) => b.textContent?.trim() === text)!;
	const hotspots = (mounted: { host: HTMLElement }) => qa<SVGElement>(mounted, '.qti-ggm-hotspot');

	test('Enter or Space picks a label up, announced; activating it again puts it down', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		const enter = key(label(mounted, 'Rain'), 'Enter');
		await settle();
		expect(enter.defaultPrevented).toBe(true);
		expect(label(mounted, 'Rain').getAttribute('aria-pressed')).toBe('true');
		expect(label(mounted, 'Rain').classList.contains('qti-ggm-label-held')).toBe(true);
		expect(live(mounted)).toBe('Picked up: Rain. Tab to a hotspot and press Enter to place it.');

		const space = key(label(mounted, 'Rain'), ' ');
		await settle();
		expect(space.defaultPrevented).toBe(true);
		expect(label(mounted, 'Rain').getAttribute('aria-pressed')).toBe('false');
		expect(live(mounted)).toBe('Selection cancelled');

		key(label(mounted, 'Sun'), ' ');
		await settle();
		expect(label(mounted, 'Sun').getAttribute('aria-pressed')).toBe('true');
		cleanupInteraction(mounted);
	});

	test('activating another label switches the held label', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		click(label(mounted, 'Rain'));
		await settle();
		click(label(mounted, 'Sun'));
		await settle();
		expect(label(mounted, 'Rain').getAttribute('aria-pressed')).toBe('false');
		expect(label(mounted, 'Sun').getAttribute('aria-pressed')).toBe('true');
		expect(live(mounted)).toBe('Picked up: Sun. Tab to a hotspot and press Enter to place it.');
		cleanupInteraction(mounted);
	});

	test('a pointer activation of a hotspot places the held label; without one it does nothing', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		click(hotspots(mounted)[0]);
		await settle();
		const idle = key(hotspots(mounted)[0]!, 'Enter');
		await settle();
		expect(idle.defaultPrevented).toBe(false);
		expect(mounted.events).toHaveLength(0);

		click(label(mounted, 'Rain'));
		await settle();
		expect(hotspots(mounted)[1]!.classList.contains('qti-ggm-hotspot-ready')).toBe(true);
		click(hotspots(mounted)[1]);
		await settle();
		expect(mounted.instance.response).toEqual(['RAIN LAKE']);
		expect(live(mounted)).toBe('Rain placed on hotspot 2');
		expect(label(mounted, 'Rain').getAttribute('aria-pressed')).toBe('false');
		expect(hotspots(mounted)[0]!.classList.contains('qti-ggm-hotspot-ready')).toBe(false);
		cleanupInteraction(mounted);
	});

	test('a placed label is retired from the palette and cannot be picked up', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData(), response: ['RAIN LAKE'] });
		await settle();

		expect(label(mounted, 'Rain').disabled).toBe(true);
		key(label(mounted, 'Rain'), 'Enter');
		await settle();
		expect(label(mounted, 'Rain').getAttribute('aria-pressed')).toBe('false');
		expect(live(mounted)).toBe('');
		cleanupInteraction(mounted);
	});

	test('Escape on the label or anywhere in the interaction puts the label down, default prevented; focus stays', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		const idle = key(label(mounted, 'Rain'), 'Escape');
		expect(idle.defaultPrevented).toBe(false);

		key(label(mounted, 'Rain'), 'Enter');
		await settle();
		const onLabel = key(label(mounted, 'Rain'), 'Escape');
		await settle();
		expect(onLabel.defaultPrevented).toBe(true);
		expect(label(mounted, 'Rain').getAttribute('aria-pressed')).toBe('false');
		expect(live(mounted)).toBe('Selection cancelled');

		key(label(mounted, 'Sun'), 'Enter');
		await settle();
		const target = hotspots(mounted)[0]!;
		target.focus();
		const onHotspot = key(target, 'Escape');
		await settle();
		expect(onHotspot.defaultPrevented).toBe(true);
		expect(label(mounted, 'Sun').getAttribute('aria-pressed')).toBe('false');
		expect(live(mounted)).toBe('Selection cancelled');
		expect(document.activeElement).toBe(target);
		cleanupInteraction(mounted);
	});

	test('a drop or the end of a drag clears the dragged label: no hotspot stays marked', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, {
			interaction: ggmData({
				gapTexts: [
					{ identifier: 'RAIN', text: 'Rain', matchMax: 1, matchGroup: ['LAKE'] },
					{ identifier: 'SUN', text: 'Sun', matchMax: 1 },
				],
				hotspots: [
					{ identifier: 'SKY', shape: 'circle', coords: '300,50,8', matchMax: 1, matchGroup: ['SUN'] },
					{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1, matchGroup: ['RAIN'] },
				],
			}),
		});
		await settle();

		label(mounted, 'Rain').dispatchEvent(new Event('dragstart', { bubbles: true }));
		await settle();
		expect(hotspots(mounted)[0]!.getAttribute('aria-disabled')).toBe('true');
		label(mounted, 'Rain').dispatchEvent(new Event('dragend', { bubbles: true }));
		await settle();
		expect(hotspots(mounted)[0]!.getAttribute('aria-disabled')).toBeNull();

		label(mounted, 'Rain').dispatchEvent(new Event('dragstart', { bubbles: true }));
		await settle();
		hotspots(mounted)[1]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['RAIN LAKE']);
		expect(hotspots(mounted)[0]!.getAttribute('aria-disabled')).toBeNull();
		cleanupInteraction(mounted);
	});
});

describe('match pick-up/place', () => {
	function matchData(overrides: Partial<MatchInteractionData> = {}): MatchInteractionData {
		return {
			type: 'matchInteraction',
			responseId: 'MATCH',
			shuffle: false,
			maxAssociations: 0,
			prompt: null,
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
	const source = (mounted: { host: HTMLElement }, id: string) => q<HTMLButtonElement>(mounted, `[data-source-id="${id}"]`)!;
	const targets = (mounted: { host: HTMLElement }) => qa<HTMLButtonElement>(mounted, '[part="target"]');

	test('selecting a source enables the targets; selecting it again puts it down, both announced', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData() });
		await settle();

		expect(targets(mounted).map((t) => t.disabled)).toEqual([true, true]);
		click(source(mounted, 'paris'));
		await settle();
		expect(source(mounted, 'paris').getAttribute('aria-pressed')).toBe('true');
		expect(source(mounted, 'paris').dataset.selected).toBe('true');
		expect(targets(mounted).map((t) => t.disabled)).toEqual([false, false]);
		expect(targets(mounted).map((t) => t.dataset.highlight)).toEqual(['true', 'true']);
		expect(live(mounted)).toBe('Paris selected');

		click(source(mounted, 'paris'));
		await settle();
		expect(source(mounted, 'paris').getAttribute('aria-pressed')).toBe('false');
		expect(targets(mounted).map((t) => t.disabled)).toEqual([true, true]);
		expect(live(mounted)).toBe('Paris deselected');
		cleanupInteraction(mounted);
	});

	test('selecting another source switches the selection', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData() });
		await settle();

		click(source(mounted, 'paris'));
		await settle();
		click(source(mounted, 'rome'));
		await settle();
		expect(source(mounted, 'paris').getAttribute('aria-pressed')).toBe('false');
		expect(source(mounted, 'rome').getAttribute('aria-pressed')).toBe('true');
		expect(live(mounted)).toBe('Rome selected');
		cleanupInteraction(mounted);
	});

	test('a refused target keeps the source selected and focus where it was', async () => {
		const mounted = mountInteraction(MatchInteraction, {
			interaction: matchData({ maxAssociations: 1 }),
			response: ['rome italy'],
		});
		await settle();

		click(source(mounted, 'paris'));
		await settle();
		const france = targets(mounted)[0]!;
		france.focus();
		click(france);
		await settle();
		expect(mounted.events).toHaveLength(0);
		expect(source(mounted, 'paris').getAttribute('aria-pressed')).toBe('true');
		expect(live(mounted)).toBe('Association not possible: the limit of 1 is reached.');
		expect(document.activeElement).toBe(france);
		cleanupInteraction(mounted);
	});

	test('Escape on the selected source puts it down, default prevented, and keeps focus on it', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData() });
		await settle();

		const idle = key(source(mounted, 'paris'), 'Escape');
		expect(idle.defaultPrevented).toBe(false);

		click(source(mounted, 'paris'));
		await settle();
		source(mounted, 'paris').focus();
		const cancel = key(source(mounted, 'paris'), 'Escape');
		await settle();
		expect(cancel.defaultPrevented).toBe(true);
		expect(source(mounted, 'paris').getAttribute('aria-pressed')).toBe('false');
		expect(live(mounted)).toBe('Selection of Paris cancelled.');
		expect(document.activeElement).toBe(source(mounted, 'paris'));
		cleanupInteraction(mounted);
	});

	test('a drag enables the targets until it drops or ends', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData() });
		await settle();

		source(mounted, 'paris').dispatchEvent(new Event('dragstart', { bubbles: true }));
		await settle();
		expect(targets(mounted).map((t) => t.disabled)).toEqual([false, false]);
		expect(source(mounted, 'paris').dataset.dragging).toBe('true');
		source(mounted, 'paris').dispatchEvent(new Event('dragend', { bubbles: true }));
		await settle();
		expect(targets(mounted).map((t) => t.disabled)).toEqual([true, true]);

		source(mounted, 'rome').dispatchEvent(new Event('dragstart', { bubbles: true }));
		await settle();
		targets(mounted)[1]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['rome italy']);
		expect(live(mounted)).toBe('Rome matched with Italy.');
		expect(source(mounted, 'rome').dataset.dragging).toBe('false');
		expect(targets(mounted).map((t) => t.disabled)).toEqual([true, true]);
		cleanupInteraction(mounted);
	});
});

describe('sortable list pick-up/place', () => {
	const items = [
		{ id: 'A', text: 'One' },
		{ id: 'B', text: 'Two' },
		{ id: 'C', text: 'Three' },
	];
	function mountList() {
		const reorders: string[][] = [];
		const mounted = mountInteraction(SortableList, {
			items,
			orderedIds: ['A', 'B', 'C'],
			onReorder: (next: string[]) => reorders.push(next),
		});
		return { mounted, reorders };
	}
	const item = (mounted: { host: HTMLElement }, index: number) => qa<HTMLButtonElement>(mounted, 'button[part="item"]')[index]!;

	test('Enter grabs and drops; arrow keys move only the grabbed item, announced, focus kept', async () => {
		const { mounted, reorders } = mountList();
		await settle();

		key(item(mounted, 0), 'ArrowDown');
		await settle();
		expect(reorders).toEqual([]);

		const grab = key(item(mounted, 0), 'Enter');
		await settle();
		expect(grab.defaultPrevented).toBe(true);
		expect(item(mounted, 0).dataset.grabbed).toBe('true');
		expect(live(mounted)).toBe('One grabbed. Current position 1 of 3. Use arrow keys to move, Space or Enter to drop.');

		item(mounted, 0).focus();
		const move = key(item(mounted, 0), 'ArrowDown');
		await settle();
		expect(move.defaultPrevented).toBe(true);
		expect(reorders).toEqual([['B', 'A', 'C']]);
		expect(live(mounted)).toBe('One moved to position 2 of 3');
		expect(document.activeElement).toBe(item(mounted, 0));

		// The list is controlled: the order prop did not change, so the item reads position 1.
		const drop = key(item(mounted, 0), ' ');
		await settle();
		expect(drop.defaultPrevented).toBe(true);
		expect(item(mounted, 0).dataset.grabbed).toBe('false');
		expect(live(mounted)).toBe('One dropped at position 1 of 3');
		cleanupInteraction(mounted);
	});

	test('grabbing another item switches the grab', async () => {
		const { mounted } = mountList();
		await settle();

		key(item(mounted, 0), 'Enter');
		await settle();
		key(item(mounted, 1), 'Enter');
		await settle();
		expect(item(mounted, 0).dataset.grabbed).toBe('false');
		expect(item(mounted, 1).dataset.grabbed).toBe('true');
		expect(live(mounted)).toBe('Two grabbed. Current position 2 of 3. Use arrow keys to move, Space or Enter to drop.');
		cleanupInteraction(mounted);
	});

	test('Escape puts the grabbed item down, default prevented; nothing grabbed, Escape does nothing', async () => {
		const { mounted } = mountList();
		await settle();

		const idle = key(item(mounted, 0), 'Escape');
		expect(idle.defaultPrevented).toBe(false);
		expect(live(mounted)).toBe('');

		key(item(mounted, 0), 'Enter');
		await settle();
		const cancel = key(item(mounted, 0), 'Escape');
		await settle();
		expect(cancel.defaultPrevented).toBe(true);
		expect(item(mounted, 0).dataset.grabbed).toBe('false');
		expect(live(mounted)).toBe('One selection cancelled');
		cleanupInteraction(mounted);
	});

	test('a move button puts a grabbed item down and moves it', async () => {
		const { mounted, reorders } = mountList();
		await settle();

		key(item(mounted, 0), 'Enter');
		await settle();
		const later = q<HTMLButtonElement>(mounted, 'button[aria-label="Move One later"]')!;
		later.click();
		await settle();
		expect(item(mounted, 0).dataset.grabbed).toBe('false');
		expect(reorders).toEqual([['B', 'A', 'C']]);
		expect(live(mounted)).toBe('One moved to position 2 of 3');
		expect(document.activeElement).toBe(later);
		cleanupInteraction(mounted);
	});

	test('a pointer drag reorders on drop and clears the dragged item', async () => {
		const { mounted, reorders } = mountList();
		await settle();

		item(mounted, 0).dispatchEvent(new Event('dragstart', { bubbles: true }));
		await settle();
		expect(item(mounted, 0).classList.contains('opacity-50')).toBe(true);
		item(mounted, 2).dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		await settle();
		expect(reorders).toEqual([['B', 'C', 'A']]);
		expect(item(mounted, 0).classList.contains('opacity-50')).toBe(false);
		cleanupInteraction(mounted);
	});
});
