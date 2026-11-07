import { afterEach, describe, expect, test } from 'vitest';
import SortableList from '../../src/shared/components/SortableList.svelte';
import {
	cleanupInteraction,
	mountInteraction,
	qa,
	q,
	settle,
} from './helpers';

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('SortableList accessible naming', () => {
	test('the item button names via the rendered rich content (image alt and MathML)', async () => {
		const mounted = mountInteraction(SortableList, {
			items: [
				{ id: 'I1', text: '<img src="volcano.png" alt="Volcano erupts">' },
				{ id: 'I2', text: '<math alttext="x squared"><msup><mi>x</mi><mn>2</mn></msup></math>' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		});
		await settle();

		const items = qa(mounted, 'button[part="item"]');
		expect(items).toHaveLength(2);
		for (const item of items) {
			expect(item.hasAttribute('aria-label')).toBe(false);
		}

		// The name source is the rendered element, so image alt participates.
		const firstNamed = document.getElementById(items[0]!.getAttribute('aria-labelledby') ?? '');
		expect(firstNamed?.querySelector('img')?.getAttribute('alt')).toBe('Volcano erupts');

		// MathML keeps its alttext in the name element instead of flattening to "x2".
		const secondNamed = document.getElementById(items[1]!.getAttribute('aria-labelledby') ?? '');
		expect(secondNamed?.querySelector('math')?.getAttribute('alttext')).toBe('x squared');
		cleanupInteraction(mounted);
	});

	test('position and grabbed state live in the describedby target', async () => {
		const mounted = mountInteraction(SortableList, {
			items: [
				{ id: 'I1', text: 'One' },
				{ id: 'I2', text: 'Two' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		});
		await settle();

		const item = q(mounted, 'button[part="item"]')!;
		const state = document.getElementById(item.getAttribute('aria-describedby') ?? '');
		expect(state?.textContent?.trim()).toBe('Position 1 of 2');
		cleanupInteraction(mounted);
	});

	test('move buttons are named for their item, and an image-only item still reads its alt', async () => {
		const mounted = mountInteraction(SortableList, {
			items: [
				{ id: 'I1', text: '<img src="sun.png" alt="Sun">' },
				{ id: 'I2', text: 'Moon' },
			],
			orderedIds: ['I1', 'I2'],
			onReorder: () => {},
		});
		await settle();

		const buttons = qa<HTMLButtonElement>(mounted, '.qti-sortable-moves button');
		expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
			'Move Sun earlier',
			'Move Sun later',
			'Move Moon earlier',
			'Move Moon later',
		]);
		cleanupInteraction(mounted);
	});
});
