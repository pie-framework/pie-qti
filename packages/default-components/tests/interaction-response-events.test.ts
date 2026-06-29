import { describe, expect, it, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createQtiChangeEvent } from '../src/shared/utils/eventHelpers';

describe('default component response event wiring', () => {
	test.each([
		{
			name: 'orderInteraction ordered response',
			responseId: 'ORDER_RESPONSE',
			value: ['step_1', 'step_2'],
		},
		{
			name: 'gapMatchInteraction directed-pair response',
			responseId: 'GAP_RESPONSE',
			value: ['W1 G1'],
		},
		{
			name: 'hottextInteraction single response',
			responseId: 'HOTTEXT_RESPONSE',
			value: 'H1',
		},
	])('creates a composed qti-change event for $name', ({ responseId, value }) => {
		const event = createQtiChangeEvent(responseId, value);

		expect(event.type).toBe('qti-change');
		expect(event.detail).toEqual({
			responseId,
			value,
			timestamp: expect.any(Number),
		});
		expect(event.bubbles).toBe(true);
		expect(event.composed).toBe(true);
	});

	it('wires orderInteraction response changes through the standardized event factory', () => {
		const order = source('src/plugins/order/OrderInteraction.svelte');

		expect(order).toContain('onChange?.(newOrder)');
		expect(order).toContain('createQtiChangeEvent(parsedInteraction?.responseId, newOrder)');
		expect(order).toContain('onChange?.(currentOrder)');
		expect(order).toContain('createQtiChangeEvent(parsedInteraction?.responseId, currentOrder)');
	});

	it('wires gapMatchInteraction response changes through the standardized event factory', () => {
		const gapMatch = source('src/plugins/gap-match/GapMatchInteraction.svelte');

		expect(gapMatch).toContain('onChange?.(newPairs)');
		expect(gapMatch).toContain('createQtiChangeEvent(parsedInteraction?.responseId, newPairs)');
	});

	it('wires hottextInteraction response changes through the standardized event factory', () => {
		const hottext = source('src/plugins/hottext/HottextInteraction.svelte');

		expect(hottext).toContain('onChange?.(responseValue)');
		expect(hottext).toContain('createQtiChangeEvent(parsedInteraction.responseId, responseValue)');
		expect(hottext).toContain('createQtiChangeEvent(parsedInteraction?.responseId, responseValue)');
	});
});

function source(relativePath: string): string {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}
