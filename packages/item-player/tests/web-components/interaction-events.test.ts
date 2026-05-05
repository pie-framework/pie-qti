import { describe, expect, test } from 'bun:test';
import type { ChoiceInteractionData } from '../../src/interactions/choice/types.js';
import {
	type InteractionResponseValue,
	QTIChangeEvent,
	type QTIInteractionElement,
} from '../../src/web-components/QTIInteractionElement.js';

describe('QTI interaction web component API types', () => {
	test('QTIChangeEvent preserves the standard change-event payload shape', () => {
		const event = new QTIChangeEvent<string[]>({
			responseId: 'RESPONSE',
			value: ['A'],
			timestamp: 123,
		});

		expect(event.type).toBe('qti-change');
		expect(event.detail).toEqual({
			responseId: 'RESPONSE',
			value: ['A'],
			timestamp: 123,
		});
		expect(event.bubbles).toBe(true);
		expect(event.composed).toBe(true);
	});

	test('response value types derive from InteractionValueMap', () => {
		const value: InteractionResponseValue<ChoiceInteractionData> = ['A', 'B'];
		const element = {} as QTIInteractionElement<ChoiceInteractionData>;

		element.response = value;

		expect(element.response).toEqual(['A', 'B']);
	});
});
