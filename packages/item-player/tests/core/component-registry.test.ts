import { describe, expect, test } from 'bun:test';
import { createComponentRegistry } from '../../src/core/ComponentRegistry.js';

describe('ComponentRegistry', () => {
	test('registers a default component with only the renderer descriptor', () => {
		const registry = createComponentRegistry();

		registry.register('choiceInteraction', {
			name: 'default-choice',
			tagName: 'pie-qti-choice',
		});

		expect(registry.hasComponent('choiceInteraction')).toBe(true);
		expect(
			registry.getTagName({
				type: 'choiceInteraction',
				responseId: 'RESPONSE',
			} as any)
		).toBe('pie-qti-choice');
	});

	test('keeps priority and canHandle for specialized component dispatch', () => {
		const registry = createComponentRegistry();

		registry.register('choiceInteraction', {
			name: 'default-choice',
			tagName: 'pie-qti-choice',
		});
		registry.register('choiceInteraction', {
			name: 'rating-choice',
			priority: 100,
			canHandle: (data: any) => data.interactionClasses?.includes('rating'),
			tagName: 'pie-qti-rating-choice',
		});

		expect(
			registry.getTagName({
				type: 'choiceInteraction',
				responseId: 'RESPONSE',
				interactionClasses: ['rating'],
			} as any)
		).toBe('pie-qti-rating-choice');
		expect(
			registry.getTagName({
				type: 'choiceInteraction',
				responseId: 'RESPONSE',
				interactionClasses: [],
			} as any)
		).toBe('pie-qti-choice');
	});

	test('uses default fallback only after higher-priority predicates decline', () => {
		const registry = createComponentRegistry();

		registry.register('choiceInteraction', {
			name: 'special-choice',
			priority: 10,
			canHandle: () => false,
			tagName: 'pie-qti-special-choice',
		});
		registry.register('choiceInteraction', {
			name: 'default-choice',
			tagName: 'pie-qti-choice',
		});

		expect(
			registry.getTagName({
				type: 'choiceInteraction',
				responseId: 'RESPONSE',
			} as any)
		).toBe('pie-qti-choice');
	});
});
