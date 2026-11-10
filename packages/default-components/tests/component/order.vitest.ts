import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import OrderInteraction from '../../src/plugins/order/OrderInteraction.svelte';
import type { OrderInteractionData } from '@pie-qti/item-player';
import {
	accessibleName,
	cleanupInteraction,
	type MountedInteraction,
	mountInteraction,
	qa,
	q,
	settle,
} from './helpers';

function orderData(overrides: Partial<OrderInteractionData> = {}): OrderInteractionData {
	return {
		type: 'orderInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		minChoices: 0,
		maxChoices: 3,
		prompt: '<p>Order the steps.</p>',
		choices: [
			{ identifier: 'S1', text: '<p>First</p>' },
			{ identifier: 'S2', text: '<p>Second</p>' },
			{ identifier: 'S3', text: '<p>Third</p>' },
		],
		...overrides,
	};
}

afterEach(() => {
	// Remove any hosts appended during the test.
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('OrderInteraction (pie-qti-order)', () => {
	test('elimination tool: toggles live in their item’s row and are named for the item', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData(),
			eliminationTool: true,
		});
		await settle();

		const buttons = qa(mounted, 'button.qti-eliminate-btn');
		expect(buttons).toHaveLength(3);

		// Each toggle is a sibling of its item inside one row container, so the
		// controls align with the item at any row height (no separate column that
		// drifts against the row pitch).
		const rows = qa(mounted, '[role="listitem"]');
		expect(rows).toHaveLength(3);
		for (const button of buttons) {
			expect(button.hasAttribute('aria-hidden')).toBe(false);
			expect(button.getAttribute('aria-pressed')).toBe('false');
			expect(rows.some((row) => row.contains(button))).toBe(true);
		}
		const firstRow = rows[0]!;
		expect(firstRow.contains(buttons[0]!)).toBe(true);
		expect(firstRow.querySelector('[part="item"]')?.textContent).toContain('First');

		// Toggles are named for their item, not just "Eliminate".
		expect(buttons[0]?.getAttribute('aria-label')).toBe('Eliminate First');
		expect(buttons[1]?.getAttribute('aria-label')).toBe('Eliminate Second');

		buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		// Elimination is scratch work: the response stays untouched.
		expect(mounted.instance.response).toBeUndefined();
		// A toggle button keeps its name; aria-pressed alone says the item is eliminated
		// (WCAG 4.1.2), so the state is announced once and the name never flips to "Restore".
		expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
		expect(buttons[0].getAttribute('aria-label')).toBe('Eliminate First');
		expect(qa(mounted, '[data-eliminated]')).toHaveLength(1);
		cleanupInteraction(mounted);
	});

	test('elimination tool: an item with nothing to read is named by its position, never its identifier', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData({
				choices: [
					{ identifier: 'S1', text: '<p>First</p>' },
					{ identifier: 'STEP_TWO_IS_CORRECT', text: '<p></p>' },
					{ identifier: 'S3', text: '<p>Third</p>' },
				],
			}),
			eliminationTool: true,
		});
		await settle();

		const label = qa(mounted, 'button.qti-eliminate-btn')[1]?.getAttribute('aria-label');
		expect(label).toBe('Eliminate Choice 2');
		expect(label).not.toContain('STEP_TWO_IS_CORRECT');
		cleanupInteraction(mounted);
	});

	test('without the elimination tool no eliminate buttons render', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: orderData() });
		await settle();

		expect(qa(mounted, 'button.qti-eliminate-btn')).toHaveLength(0);
		cleanupInteraction(mounted);
	});

	test('move buttons are named for their item, including rich item content', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData({
				choices: [
					{ identifier: 'S1', text: '<img src="volcano.png" alt="Volcano erupts">' },
					{ identifier: 'S2', text: '<p>Second</p>' },
					{ identifier: 'S3', text: '<p>Third</p>' },
				],
			}),
		});
		await settle();

		const rows = qa(mounted, '[role="listitem"]');
		const moveButtons = qa<HTMLButtonElement>(mounted, 'button[part="item"] + .qti-sortable-moves button');
		expect(moveButtons.map((b) => b.getAttribute('aria-label'))).toEqual([
			'Move Volcano erupts earlier',
			'Move Volcano erupts later',
			'Move Second earlier',
			'Move Second later',
			'Move Third earlier',
			'Move Third later',
		]);

		// The item name comes from the rendered rich content: image alt participates.
		expect(rows[0]?.querySelector('[part="text"]')?.querySelector('img')?.getAttribute('alt')).toBe('Volcano erupts');
		cleanupInteraction(mounted);
	});

	test('the item button names via the rendered rich content, with position in the description', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData({
				choices: [
					{ identifier: 'S1', text: '<img src="volcano.png" alt="Volcano erupts">' },
					{ identifier: 'S2', text: '<p>Second</p>' },
				],
			}),
		});
		await settle();

		const item = q(mounted, 'button[part="item"]');
		const labelledBy = item?.getAttribute('aria-labelledby') ?? '';
		const namedElement = labelledBy ? document.getElementById(labelledBy) : null;
		expect(namedElement?.querySelector('img')?.getAttribute('alt')).toBe('Volcano erupts');

		const describedBy = item?.getAttribute('aria-describedby') ?? '';
		const stateText = describedBy ? document.getElementById(describedBy)?.textContent?.trim() : '';
		expect(stateText).toContain('Position 1 of 2');
		cleanupInteraction(mounted);
	});

	test('the confirm button is named by its visible label, the sentence is a description (WCAG 2.5.3)', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: orderData() });
		await settle();

		const confirm = q<HTMLButtonElement>(mounted, 'button[part="confirm"]')!;
		expect(confirm).not.toBeNull();
		// A voice-control user says the visible label: it must name the control (label in name).
		// The aria-label used to override the visible text with a different sentence entirely.
		expect(confirm.getAttribute('aria-label')).toBeNull();
		expect(confirm.textContent?.trim()).toBe('Confirm Order (No Changes)');
		// The extra sentence ("Confirm this order as your answer") stays, as the description.
		const describedBy = confirm.getAttribute('aria-describedby') ?? '';
		expect(describedBy).not.toBe('');
		expect(document.getElementById(describedBy)?.textContent?.trim()).toBe('Confirm this order as your answer');

		// The confirmed state is inert and named by its visible badge.
		confirm.focus();
		confirm.click();
		await settle();
		const confirmed = q<HTMLButtonElement>(mounted, 'button[part="confirmed"]')!;
		expect(confirmed.getAttribute('aria-label')).toBeNull();
		expect(confirmed.textContent?.trim()).toBe('Order confirmed');
		cleanupInteraction(mounted);
	});

	test('confirm keeps its control mounted, focused, and announced (round 6)', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: orderData() });
		await settle();

		const confirm = q<HTMLButtonElement>(mounted, 'button[part="confirm"]')!;
		expect(confirm).not.toBeNull();
		confirm.focus();
		confirm.click();
		await settle();

		// The control is not removed: it flips to a disabled "Order confirmed" state and
		// keyboard focus stays on it instead of falling to the document body.
		const confirmed = q<HTMLButtonElement>(mounted, 'button[part="confirmed"]');
		expect(confirmed).not.toBeNull();
		expect(confirmed?.getAttribute('aria-disabled')).toBe('true');
		expect(confirmed?.getAttribute('tabindex')).toBe('-1');
		expect(confirmed?.textContent).toContain('Order confirmed');
		expect(document.activeElement).toBe(confirmed);

		// The always-present polite region announces the confirmation.
		const live = mounted.host.querySelector('.qti-order-confirmation-live');
		expect(live?.textContent).toContain('Order confirmed');
		cleanupInteraction(mounted);
	});
});

/**
 * Subset ordering (QTI 2.2 ASI §5.73, §2.4.1.2): when minChoices is specified and below the
 * number of choices, the candidate selects which choices to order ("Your order") and which
 * stay out ("Not in your order"), instead of being handed every choice.
 */
describe('OrderInteraction subset ordering (minChoices/maxChoices)', () => {
	function subsetData(overrides: Partial<OrderInteractionData> = {}): OrderInteractionData {
		return orderData({
			choices: [
				{ identifier: 'C1', text: '<p>Ask a question</p>' },
				{ identifier: 'C2', text: '<p>Conduct research</p>' },
				{ identifier: 'C3', text: '<p>Form a hypothesis</p>' },
				{ identifier: 'C4', text: '<p>Test the hypothesis</p>' },
				{ identifier: 'C5', text: '<p>Share results</p>' },
			],
			minChoices: 2,
			maxChoices: 2,
			...overrides,
		});
	}

	/** Whether the order list's aria-describedby names the visible hint. */
	function describesList(mounted: MountedInteraction): boolean {
		const hintId = q(mounted, '[part="min-hint"]')?.id;
		const described = q(mounted, '[role="list"]')?.getAttribute('aria-describedby') ?? '';
		return !!hintId && described.split(/\s+/).includes(hintId);
	}

	/** Add the named choice from the pool by clicking its add control. */
	async function addItem(mounted: MountedInteraction, id: string) {
		q<HTMLButtonElement>(mounted, `button[part="pool-add"][data-id="${id}"]`)!.click();
		await settle();
	}

	test('subset mode renders two zones and starts with an empty order', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		expect(q(mounted, '[data-subset-mode="true"]')).not.toBeNull();
		expect(q(mounted, '[part="ordered-zone"]')).not.toBeNull();
		expect(q(mounted, '[part="pool-zone"]')).not.toBeNull();

		// No choice is ordered before the candidate acts: the response is null until interaction
		// (FR-5's untouched contract), and the order zone says so.
		expect(mounted.instance.response ?? null).toBeNull();
		expect(q(mounted, '[part="ordered-empty"]')?.textContent).toContain('Nothing is in your order yet.');
		expect(qa(mounted, '[part="ordered-zone"] button[part="item"]')).toHaveLength(0);

		// Every choice waits in the pool, named by its text, never its identifier.
		const pool = qa<HTMLButtonElement>(mounted, 'button[part="pool-add"]');
		expect(pool.map((b) => b.dataset.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5']);
		expect(accessibleName(pool[0]!)).toBe('Add Ask a question to your order');
		cleanupInteraction(mounted);
	});

	test('the limits are stated up front, in the described-by group (WCAG 3.3.2)', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		expect(q(mounted, '[part="min-hint"]')?.textContent).toBe('Choose 2 items and put them in order.');
		expect(describesList(mounted)).toBe(true);

		// A range renders as a range.
		const ranged = mountInteraction(OrderInteraction, {
			interaction: subsetData({ minChoices: 1, maxChoices: 3 }),
		});
		await settle();
		expect(q(ranged, '[part="min-hint"]')?.textContent).toBe('Choose between 1 and 3 items and put them in order.');
		cleanupInteraction(mounted, ranged);
	});

	test('adding from the pool orders the item, removes it from the pool, and emits the subset response', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		await addItem(mounted, 'C3');
		await addItem(mounted, 'C1');

		expect(mounted.instance.response).toEqual(['C3', 'C1']);
		expect(qa(mounted, 'button[part="pool-add"]').map((b) => b.dataset.id)).toEqual(['C2', 'C4', 'C5']);

		// The ordered rows carry the choice's text, as in full mode.
		const ordered = qa(mounted, '[part="ordered-zone"] button[part="item"]');
		expect(ordered.map((row) => accessibleName(row))).toEqual(['Form a hypothesis', 'Ask a question']);
		expect(q(mounted, '[part="ordered-empty"]')).toBeNull();

		// The change event carries the ordered subset.
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['C3', 'C1'] });
		cleanupInteraction(mounted);
	});

	test('removing from the order returns the item to the pool and updates the response', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: subsetData(),
			response: ['C2', 'C5', 'C1'],
		});
		await settle();

		// A restored subset response: the listed items are ordered in sequence, the rest pool.
		expect(qa(mounted, '[part="ordered-zone"] button[part="item"]').map((row) => accessibleName(row))).toEqual([
			'Conduct research',
			'Share results',
			'Ask a question',
		]);
		expect(qa(mounted, 'button[part="pool-add"]').map((b) => b.dataset.id)).toEqual(['C3', 'C4']);

		q<HTMLButtonElement>(mounted, 'button[part="order-remove"][data-id="C5"]')!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['C2', 'C1']);
		expect(qa(mounted, 'button[part="pool-add"]').map((b) => b.dataset.id)).toEqual(['C3', 'C4', 'C5']);
		cleanupInteraction(mounted);
	});

	test('adding past the cap is refused, announced, and leaves the response unchanged', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		await addItem(mounted, 'C1');
		await addItem(mounted, 'C4');
		expect(mounted.instance.response).toEqual(['C1', 'C4']);

		await addItem(mounted, 'C2');

		expect(mounted.instance.response).toEqual(['C1', 'C4']);
		expect(qa(mounted, 'button[part="pool-add"]').map((b) => b.dataset.id)).toEqual(['C2', 'C3', 'C5']);
		const live = mounted.host.querySelector('[data-subset-live]');
		const firstRefusal = live?.textContent?.length ?? 0;
		expect(live?.textContent).toContain('Your order can hold up to 2 items. Remove one to add another.');

		// Repeating the same refused action re-announces (zero-width space toggle), so a second
		// press is not silent to assistive technology.
		await addItem(mounted, 'C2');
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent?.length).toBeGreaterThan(firstRefusal);
		cleanupInteraction(mounted);
	});

	test('add, remove and reordering announce through the polite live region', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData({ minChoices: 1, maxChoices: 3 }) });
		await settle();

		await addItem(mounted, 'C2');
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent).toContain(
			'Conduct research added to your order at position 1 of 1.',
		);

		await addItem(mounted, 'C3');
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent).toContain(
			'Form a hypothesis added to your order at position 2 of 2.',
		);

		// Reorder through the existing move buttons announces the new position like full mode
		// does, through SortableList's own polite region (add/remove/refusals use the subset's).
		q<HTMLButtonElement>(mounted, 'button[aria-label="Move Form a hypothesis earlier"]')!.click();
		await settle();
		expect(q(mounted, '[part="ordered-zone"] [aria-live="polite"]')?.textContent).toContain(
			'Form a hypothesis moved to position 1 of 2',
		);

		q<HTMLButtonElement>(mounted, 'button[part="order-remove"][data-id="C3"]')!.click();
		await settle();
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent).toContain(
			'Form a hypothesis removed from your order.',
		);
		cleanupInteraction(mounted);
	});

	test('the subset controls meet the 24x24 CSS px minimum target', () => {
		const source = readFileSync(resolve(__dirname, '../../src/shared/components/OrderSubset.svelte'), 'utf8');
		const style = source.slice(source.indexOf('<style>'));
		// The whole pool row is the add target; remove matches the 44px move buttons beside it.
		expect(style).toMatch(/\.qti-subset-add\s*\{[^}]*min-block-size:\s*2\.75rem/s);
		expect(style).toMatch(/\.qti-subset-remove\s*\{[^}]*min-inline-size:\s*2\.75rem/s);
		expect(style).toMatch(/\.qti-subset-remove\s*\{[^}]*min-block-size:\s*2\.75rem/s);
		// The at-cap and disabled states keep a system colour under forced colors.
		expect(style).toMatch(/@media \(forced-colors: active\)[\s\S]*GrayText/);
		// Logical properties only, so the zones mirror under RTL.
		expect(style).not.toMatch(/(?:margin|padding)-(?:left|right)\s*:|text-align:\s*(?:left|right)/);
	});

	test('focus follows the item: add lands on its remove control, remove on its add control', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		await addItem(mounted, 'C4');
		expect(document.activeElement).toBe(q(mounted, 'button[part="order-remove"][data-id="C4"]'));
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Test the hypothesis from your order');

		q<HTMLButtonElement>(mounted, 'button[part="order-remove"][data-id="C4"]')!.click();
		await settle();
		expect(document.activeElement).toBe(q(mounted, 'button[part="pool-add"][data-id="C4"]'));
		expect(mounted.instance.response).toBeNull();
		cleanupInteraction(mounted);
	});

	test('a restored response with unknown or repeated identifiers still renders each known choice once', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: subsetData({ minChoices: 1, maxChoices: 3 }),
			response: ['C2', 'NOT_A_CHOICE', 'C2', 'C4'],
			correctResponse: ['C4', 'C4'],
			role: 'scorer',
		});
		await settle();

		expect(qa(mounted, '[part="ordered-zone"] button[part="item"]').map((row) => accessibleName(row))).toEqual([
			'Conduct research',
			'Test the hypothesis',
		]);
		expect(qa(mounted, '[part="correct-order"] li').map((li) => li.textContent?.trim())).toEqual([
			'Test the hypothesis',
		]);
		cleanupInteraction(mounted);
	});

	test('removing the last ordered item returns the response to NULL', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData(), response: ['C2'] });
		await settle();

		q<HTMLButtonElement>(mounted, 'button[part="order-remove"][data-id="C2"]')!.click();
		await settle();
		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: null });
		expect(q(mounted, '[part="ordered-empty"]')).not.toBeNull();
		cleanupInteraction(mounted);
	});

	test('at the cap the remaining add controls stay focusable but read as unavailable', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		expect(q(mounted, 'button[part="pool-add"][aria-disabled="true"]')).toBeNull();
		await addItem(mounted, 'C1');
		await addItem(mounted, 'C2');

		const remaining = qa<HTMLButtonElement>(mounted, 'button[part="pool-add"]');
		expect(remaining).toHaveLength(3);
		for (const button of remaining) {
			expect(button.getAttribute('aria-disabled')).toBe('true');
			expect(button.disabled).toBe(false);
		}
		cleanupInteraction(mounted);
	});

	test('names come from the choice text, never the identifiers', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: subsetData({
				choices: [
					{ identifier: 'RANK_1_CORRECT', text: '<img src="sun.png" alt="The Sun">' },
					{ identifier: 'RANK_2_CORRECT', text: '<p>The Moon</p>' },
					{ identifier: 'DISTRACTOR', text: '<p>A comet</p>' },
				],
				minChoices: 1,
				maxChoices: 2,
			}),
			response: ['RANK_2_CORRECT'],
		});
		await settle();

		expect(q(mounted, 'button[part="pool-add"][data-id="RANK_1_CORRECT"]')?.getAttribute('aria-label')).toBe(
			'Add The Sun to your order',
		);
		expect(q(mounted, 'button[part="order-remove"]')?.getAttribute('aria-label')).toBe('Remove The Moon from your order');
		const perceived = [
			mounted.host.textContent ?? '',
			...qa(mounted, 'button, [role]').map((element) => accessibleName(element)),
			...qa(mounted, '[aria-label], [title]').map(
				(element) => `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`,
			),
		].join(' ');
		for (const identifier of ['RANK_1_CORRECT', 'RANK_2_CORRECT', 'DISTRACTOR']) {
			expect(perceived).not.toContain(identifier);
		}
		cleanupInteraction(mounted);
	});

	test('the zones are labelled lists, and the empty order describes itself', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		const [orderList, pool] = qa(mounted, '[role="list"]');
		expect(accessibleName(orderList!)).toBe('Your order');
		expect(accessibleName(pool!)).toBe('Not in your order');
		const described = (orderList!.getAttribute('aria-describedby') ?? '').split(/\s+/);
		expect(described).toContain(q(mounted, '[part="ordered-empty"]')?.id);
		cleanupInteraction(mounted);
	});

	test('the elimination tool offers one toggle per choice in whichever zone it is', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: subsetData(),
			response: ['C3'],
			eliminationTool: true,
		});
		await settle();

		const toggles = qa<HTMLButtonElement>(mounted, 'button.qti-eliminate-btn');
		expect(toggles.map((toggle) => toggle.getAttribute('aria-label')).sort()).toEqual(
			[
				'Eliminate Ask a question',
				'Eliminate Conduct research',
				'Eliminate Form a hypothesis',
				'Eliminate Share results',
				'Eliminate Test the hypothesis',
			].sort(),
		);
		cleanupInteraction(mounted);
	});

	test('the scorer view shows the authored subset as the correct order, read-only', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: subsetData(),
			role: 'scorer',
			disabled: true,
			correctResponse: ['C3', 'C1'],
			response: ['C1', 'C3'],
		});
		await settle();

		// The candidate's subset stays visible, marked against the key position by position…
		const rows = qa<HTMLButtonElement>(mounted, '[part="ordered-zone"] button[part="item"]');
		expect(rows.map((row) => accessibleName(row))).toEqual(['Ask a question', 'Form a hypothesis']);
		expect(rows.map((row) => row.dataset.correct)).toEqual(['false', 'false']);
		// …and the authored subset is listed as the correct order.
		const correct = qa(mounted, '[part="correct-order"] li').map((li) => li.textContent?.trim());
		expect(correct).toEqual(['Form a hypothesis', 'Ask a question']);
		expect(accessibleName(q(mounted, '[part="correct-order"]')!)).toBe('Correct order');
		// Read-only: no add or remove controls act.
		expect(qa(mounted, 'button[part="order-remove"]')).toHaveLength(0);
		for (const add of qa<HTMLButtonElement>(mounted, 'button[part="pool-add"]')) expect(add.disabled).toBe(true);
		cleanupInteraction(mounted);
	});

	test('candidates never see the correct order', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: subsetData(),
			correctResponse: ['C3', 'C1'],
		});
		await settle();
		expect(q(mounted, '[part="correct-order"]')).toBeNull();
		cleanupInteraction(mounted);
	});

	test('no confirm step in subset mode: adding is the deliberate act', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: subsetData() });
		await settle();

		expect(q(mounted, 'button[part="confirm"]')).toBeNull();
		await addItem(mounted, 'C1');
		expect(q(mounted, 'button[part="confirm"]')).toBeNull();
		expect(mounted.events).toHaveLength(1);
		cleanupInteraction(mounted);
	});

	test('full mode keeps rendering the single full-permutation list', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData({ minChoices: 0, maxChoices: 0 }),
		});
		await settle();

		expect(q(mounted, '[data-subset-mode="true"]')).toBeNull();
		expect(qa(mounted, 'button[part="item"]')).toHaveLength(3);
		expect(mounted.instance.response).toBeUndefined();
		cleanupInteraction(mounted);
	});

	test('minChoices >= N orders every choice (effectively full), whatever maxChoices says', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData({ minChoices: 3, maxChoices: 1 }),
		});
		await settle();

		expect(q(mounted, '[data-subset-mode="true"]')).toBeNull();
		expect(qa(mounted, 'button[part="item"]')).toHaveLength(3);
		cleanupInteraction(mounted);
	});
});

// createInteractionShell's rule: correct-answer mode is the scorer's view of an item that has a
// correct response. Hosts pass null when the item declares none; a scorer then sees the
// interaction as a candidate does. Only `disabled` stops interaction.
describe('OrderInteraction correct-answer mode: role × correct response', () => {
	const key = ['S1', 'S2', 'S3'];

	test.each([
		['candidate', key, false],
		['candidate', null, false],
		['scorer', key, true],
		['scorer', null, false],
	] as const)('%s, correct response %j: correct-answer mode is %s, and reordering emits', async (role, correctResponse, correctMode) => {
		const mounted = mountInteraction(OrderInteraction, { interaction: orderData(), role, correctResponse });
		await settle();

		// The authored order matches the key, so in correct-answer mode every item is marked.
		const items = qa<HTMLButtonElement>(mounted, 'button[part="item"]');
		expect(items.map((item) => item.dataset.correct)).toEqual(Array(3).fill(String(correctMode)));

		q<HTMLButtonElement>(mounted, 'button[aria-label="Move First later"]')!.click();
		await settle();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['S2', 'S1', 'S3'] });
		cleanupInteraction(mounted);
	});

	test('disabled stops reordering for a scorer without a correct response too', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData(),
			role: 'scorer',
			correctResponse: null,
			disabled: true,
		});
		await settle();

		expect(qa(mounted, 'button.qti-sortable-move')).toHaveLength(0);
		expect(qa<HTMLButtonElement>(mounted, 'button[part="item"]').every((item) => item.disabled)).toBe(true);
		expect(mounted.events).toHaveLength(0);
		cleanupInteraction(mounted);
	});
});
