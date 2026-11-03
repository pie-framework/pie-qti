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
	test('elimination tool: buttons are exposed to the accessibility tree and toggle', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData(),
			eliminationTool: true,
		});
		await settle();

		const buttons = qa(mounted, 'button.qti-eliminate-btn');
		expect(buttons).toHaveLength(3);

		// Operable controls must not be hidden from assistive technology
		// (WCAG 4.1.2): no ancestor column or button may carry aria-hidden.
		expect(q(mounted, '.qti-order-elimination-col')?.hasAttribute('aria-hidden')).toBe(false);
		for (const button of buttons) {
			expect(button.hasAttribute('aria-hidden')).toBe(false);
			expect(button.getAttribute('aria-pressed')).toBe('false');
		}

		buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		// Elimination is scratch work: the response stays untouched.
		expect(mounted.instance.response).toBeUndefined();
		expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
		expect(buttons[0].getAttribute('aria-label')).toBe('Restore');
		expect(qa(mounted, '[data-eliminated]')).toHaveLength(1);
	});

	test('without the elimination tool no eliminate buttons render', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: orderData() });
		await settle();

		expect(qa(mounted, 'button.qti-eliminate-btn')).toHaveLength(0);
		cleanupInteraction(mounted);
	});
});
