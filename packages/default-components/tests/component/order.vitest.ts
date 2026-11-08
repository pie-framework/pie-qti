import { afterEach, describe, expect, test } from 'vitest';
import OrderInteraction from '../../src/plugins/order/OrderInteraction.svelte';
import type { OrderInteractionData } from '@pie-qti/item-player';
import {
	cleanupInteraction,
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
		expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
		expect(buttons[0].getAttribute('aria-label')).toBe('Restore First');
		expect(qa(mounted, '[data-eliminated]')).toHaveLength(1);
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
