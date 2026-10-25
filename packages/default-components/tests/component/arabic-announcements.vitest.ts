import { DefaultI18nProvider } from '@pie-qti/i18n';
import type { AssociableChoice } from '@pie-qti/item-player';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import MatchDragDrop from '../../src/shared/components/MatchDragDrop.svelte';
import SortableList from '../../src/shared/components/SortableList.svelte';
import { mountInteraction, pressKey, q, qa, settle } from './helpers';

let ar: DefaultI18nProvider;

beforeAll(async () => {
	ar = new DefaultI18nProvider('ar');
	await ar.loadLocale('ar');
});

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

function liveRegion(mounted: { host: HTMLElement }): string {
	return q(mounted, '[aria-live="polite"]')?.textContent?.trim() ?? '';
}

describe('SortableList under an Arabic provider', () => {
	const items = [
		{ id: 'A', text: 'تفاحة' },
		{ id: 'B', text: 'موزة' },
	];

	test('keyboard instructions and grab/drop announcements are Arabic', async () => {
		const mounted = mountInteraction(SortableList, {
			items,
			orderedIds: ['A', 'B'],
			i18n: ar,
			onReorder: () => {},
		});
		await settle();

		expect(q(mounted, '#sortable-instructions')?.textContent?.trim()).toBe(
			'اضغط على مفتاح المسافة أو الإدخال للإمساك بعنصر. استخدم مفاتيح الأسهم لتحريك العنصر. اضغط على مفتاح المسافة أو الإدخال مرة أخرى للإفلات. اضغط على Escape للإلغاء.',
		);

		const first = qa<HTMLElement>(mounted, '[part="item"]')[0]!;
		pressKey(first, 'Enter');
		await settle();
		expect(liveRegion(mounted)).toBe(
			'تم الإمساك بـ تفاحة. الموضع الحالي 1 من 2. استخدم مفاتيح الأسهم للتحريك، مفتاح المسافة أو الإدخال للإفلات.',
		);

		pressKey(first, 'Enter');
		await settle();
		expect(liveRegion(mounted)).toBe('تم إفلات تفاحة في الموضع 1 من 2');
	});
});

describe('MatchDragDrop under an Arabic provider', () => {
	const sourceSet = [{ identifier: 'S1', text: 'Apple', matchMax: 2 }] as AssociableChoice[];
	const targetSet = [
		{ identifier: 'T1', text: 'Red', matchMax: 1 },
		{ identifier: 'T2', text: 'Green', matchMax: 1 },
	] as AssociableChoice[];

	test('a matched source names its targets as an Arabic list', async () => {
		const mounted = mountInteraction(MatchDragDrop, {
			sourceSet,
			targetSet,
			pairs: ['S1 T1', 'S1 T2'],
			i18n: ar,
			onPairsChange: () => {},
		});
		await settle();

		expect(q(mounted, '[data-source-id="S1"]')?.getAttribute('aria-label')).toBe('Apple. مطابق مع Red وGreen.');
	});

	test('creating a pair announces it in Arabic', async () => {
		const mounted = mountInteraction(MatchDragDrop, {
			sourceSet,
			targetSet,
			pairs: [],
			i18n: ar,
			onPairsChange: () => {},
		});
		await settle();

		q<HTMLButtonElement>(mounted, '[data-source-id="S1"]')!.click();
		await settle();
		qa<HTMLButtonElement>(mounted, '[part="target"]')[0]!.click();
		await settle();

		expect(liveRegion(mounted)).toBe('تمت مطابقة Apple مع Red.');
	});
});
