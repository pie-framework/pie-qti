import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import SplitPaneResizer from '../../src/components/SplitPaneResizer.svelte';
import { mountInto, settle, type Mounted } from './helpers';
import { reactiveProps } from './reactive-props.svelte';

const mounted: Mounted[] = [];
const originalMatchMedia = window.matchMedia;

/** jsdom has no ResizeObserver, so the layout follows this mock's viewport match. */
let viewport: { matches: boolean };
function stubMatchMedia() {
	const query = {
		matches: false,
		media: '(max-width: 48rem)',
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => true,
	};
	viewport = {
		get matches() {
			return query.matches;
		},
		set matches(value: boolean) {
			query.matches = value;
		},
	};
	window.matchMedia = (() => query) as typeof window.matchMedia;
}

beforeEach(() => {
	stubMatchMedia();
	localStorage.clear();
});

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	window.matchMedia = originalMatchMedia;
});

function splitNow(): number {
	const splitter = document.querySelector<HTMLElement>('[role="separator"]')!;
	return Number(splitter.getAttribute('aria-valuenow'));
}

describe('the persisted split', () => {
	test('is restored instead of the prop default', async () => {
		localStorage.setItem('pie-qti22-assessment-player.splitLeftPct', '70');
		const m = mountInto(SplitPaneResizer, reactiveProps({}));
		mounted.push(m);
		await settle();
		expect(splitNow()).toBe(70);
	});

	test('falls back to the prop default when storage holds nothing', async () => {
		const m = mountInto(SplitPaneResizer, reactiveProps({}));
		mounted.push(m);
		await settle();
		expect(splitNow()).toBe(50);
	});

	test('is clamped into the splitter range', async () => {
		localStorage.setItem('pie-qti22-assessment-player.splitLeftPct', '90');
		const m = mountInto(SplitPaneResizer, reactiveProps({}));
		mounted.push(m);
		await settle();
		expect(splitNow()).toBe(75);
	});
});
