import { describe, expect, test } from 'bun:test';
import type { QTIChangeEventDetail } from '@pie-qti/item-player/web-components';
import { createQtiChangeEvent } from '../../../src/shared/utils/eventHelpers.js';

describe('createQtiChangeEvent', () => {
	test('creates qti-change payload with required responseId', () => {
		const event: CustomEvent<QTIChangeEventDetail<string>> = createQtiChangeEvent('RESPONSE', 'A');
		expect(event.type).toBe('qti-change');
		expect(event.detail.responseId).toBe('RESPONSE');
		expect(event.detail.value).toBe('A');
		expect(typeof event.detail.timestamp).toBe('number');
	});

	test('throws when responseId is missing', () => {
		expect(() => createQtiChangeEvent(undefined, 'A')).toThrow('responseId');
	});
});
