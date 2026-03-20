import { describe, expect, test } from 'bun:test';
import { assignProps } from '../dom/assignProps.js';

describe('dom utils', () => {
	test('assignProps skips undefined by default', () => {
		const el = { count: 3 } as unknown as HTMLElement & { count?: number };
		el.count = 3;

		assignProps(el, { count: undefined });

		expect(el.count).toBe(3);
	});

	test('assignProps can write undefined when requested', () => {
		const el = { count: 3 } as unknown as HTMLElement & { count?: number };
		el.count = 3;

		assignProps(el, { count: undefined }, { skipUndefined: false });

		expect(el.count).toBeUndefined();
	});
});
