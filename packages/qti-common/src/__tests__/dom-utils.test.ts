import { describe, expect, test } from 'bun:test';
import { assignProps } from '../dom/assignProps.js';
import { createSvelteMountController } from '../dom/svelteMountController.js';

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

	test('createSvelteMountController updates mounted instances with $set', () => {
		const calls: Array<Record<string, unknown>> = [];
		const host = fakeHost();
		const controller = createSvelteMountController({
			host,
			createContainer: fakeContainer,
			mount: (_target, props: Record<string, unknown>) => ({
				$set(next: Record<string, unknown>) {
					calls.push(next);
				},
				props,
			}),
			unmount: () => {},
		});

		controller.mountOrUpdate({ value: 1 });
		controller.update({ value: 2 });

		expect(calls).toEqual([{ value: 2 }]);
		expect(controller.mounted).toBe(true);
	});

	test('createSvelteMountController coalesces remounts for instances without $set', async () => {
		let mountCount = 0;
		let unmountCount = 0;
		const host = fakeHost();
		const controller = createSvelteMountController({
			host,
			createContainer: fakeContainer,
			mount: (_target, props: Record<string, unknown>) => {
				mountCount += 1;
				return { props };
			},
			unmount: () => {
				unmountCount += 1;
			},
		});

		controller.mountOrUpdate({ value: 1 });
		controller.update({ value: 2 });
		controller.update({ value: 3 });
		await Promise.resolve();

		expect(mountCount).toBe(2);
		expect(unmountCount).toBe(1);
		expect(controller.instance).toEqual({ props: { value: 3 } });
	});
});

function fakeHost() {
	return {
		isConnected: true,
		appendChild() {},
	} as unknown as HTMLElement;
}

function fakeContainer() {
	return {
		remove() {},
	} as unknown as HTMLElement;
}
