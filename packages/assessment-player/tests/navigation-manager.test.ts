import { describe, expect, test } from 'bun:test';
import { NavigationManager } from '../src/core/NavigationManager.js';

describe('NavigationManager', () => {
	test('linear mode permits only the current item or the immediate next item', () => {
		const navigation = new NavigationManager('linear', 5);

		expect(navigation.canNavigateTo(2, 2)).toBe(true);
		expect(navigation.canNavigateTo(3, 2)).toBe(true);
		expect(navigation.canNavigateTo(1, 2)).toBe(false);
		expect(navigation.canNavigateTo(4, 2)).toBe(false);
	});

	test('linear mode never exposes previous navigation', () => {
		const navigation = new NavigationManager('linear', 5);

		expect(navigation.canPrevious(3)).toBe(false);
		expect(navigation.getPreviousIndex(3)).toBeNull();
	});

	test('nonlinear mode permits backwards and arbitrary navigation', () => {
		const navigation = new NavigationManager('nonlinear', 5);

		expect(navigation.canNavigateTo(0, 3)).toBe(true);
		expect(navigation.canNavigateTo(4, 1)).toBe(true);
		expect(navigation.canPrevious(3)).toBe(true);
		expect(navigation.getPreviousIndex(3)).toBe(2);
	});

	test('both modes reject out-of-range targets', () => {
		for (const mode of ['linear', 'nonlinear'] as const) {
			const navigation = new NavigationManager(mode, 3);
			expect(navigation.canNavigateTo(-1, 0)).toBe(false);
			expect(navigation.canNavigateTo(3, 0)).toBe(false);
		}
	});
});
