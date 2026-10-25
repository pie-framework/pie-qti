import { afterEach, describe, expect, test } from 'vitest';
import SortableList from '../../src/shared/components/SortableList.svelte';
import { mountInteraction, pressKey, qa, settle } from './helpers';

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
	document.documentElement.removeAttribute('dir');
	document.documentElement.style.direction = '';
});

const items = [
	{ id: 'A', text: 'One' },
	{ id: 'B', text: 'Two' },
	{ id: 'C', text: 'Three' },
];

async function moveMiddle(key: string): Promise<string[] | undefined> {
	let order: string[] | undefined;
	const mounted = mountInteraction(SortableList, {
		items,
		orderedIds: ['A', 'B', 'C'],
		orientation: 'horizontal',
		onReorder: (next: string[]) => {
			order = next;
		},
	});
	await settle();
	const middle = qa<HTMLElement>(mounted, '[part="item"]')[1]!;
	pressKey(middle, 'Enter');
	await settle();
	pressKey(middle, key);
	await settle();
	return order;
}

describe('horizontal SortableList keys follow the inline direction', () => {
	test('LTR: ArrowLeft moves earlier, ArrowRight moves later', async () => {
		expect(await moveMiddle('ArrowLeft')).toEqual(['B', 'A', 'C']);
		expect(await moveMiddle('ArrowRight')).toEqual(['A', 'C', 'B']);
	});

	test('RTL: ArrowRight moves earlier, ArrowLeft moves later', async () => {
		document.documentElement.setAttribute('dir', 'rtl');
		document.documentElement.style.direction = 'rtl';
		expect(await moveMiddle('ArrowRight')).toEqual(['B', 'A', 'C']);
		expect(await moveMiddle('ArrowLeft')).toEqual(['A', 'C', 'B']);
	});
});
