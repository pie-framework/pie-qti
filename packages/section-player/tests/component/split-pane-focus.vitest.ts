import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import SplitPaneResizer from '../../src/components/SplitPaneResizer.svelte';
import { mountInto, press, settle, type Mounted } from './helpers';
import { reactiveProps } from './reactive-props.svelte';

const mounted: Mounted[] = [];
const originalMatchMedia = window.matchMedia;

const passageSnippet = createRawSnippet(() => ({
	render: () => '<button type="button" class="passage-toggle">Collapse passage</button>',
}));
const questionSnippet = createRawSnippet(() => ({
	render: () => '<button type="button" class="question-control">Flag question</button>',
}));

/** jsdom has no ResizeObserver, so the layout follows this mock's viewport match. */
let viewport: { matches: boolean; change(): void };
function viewportIsWide() {
	const listeners = new Set<() => void>();
	const query = {
		matches: false,
		media: '(max-width: 48rem)',
		onchange: null,
		addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
		removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => {
			for (const listener of listeners) listener();
			return true;
		},
	};
	viewport = {
		get matches() {
			return query.matches;
		},
		set matches(value: boolean) {
			query.matches = value;
		},
		change: () => query.dispatchEvent(new Event('change')),
	};
	// The same query object each time: the layout keeps the one it got, so flipping
	// `matches` on it is what the layout observes.
	window.matchMedia = (() => query) as typeof window.matchMedia;
}

async function narrowViewportNow() {
	viewport.matches = true;
	viewport.change();
	await settle();
}

let current: Mounted['host'] | null = null;

function tabs() {
	return Array.from(current!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
}

beforeEach(() => {
	viewportIsWide();
	localStorage.clear();
});

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	window.matchMedia = originalMatchMedia;
});

describe('stacking with focus in a pane', () => {
	test('after an item change, focus on a passage control selects the passage tab and keeps the control focused', async () => {
		const state = reactiveProps({ leftPane: passageSnippet, children: questionSnippet, activeItemKey: 'section-1:q1:0' });
		const m = mountInto(SplitPaneResizer, state);
		mounted.push(m);
		current = m.host;
		await settle();

		// A newly presented item selects the question tab (unobservable while the panes
		// are side by side, but it decides which pane stacking hides).
		state.activeItemKey = 'section-1:q2:1';
		await settle();

		// The candidate then focuses a control in the passage pane, and the viewport narrows.
		const toggle = document.querySelector<HTMLElement>('.passage-toggle')!;
		toggle.focus();
		expect(document.activeElement).toBe(toggle);

		await narrowViewportNow();

		// The passage pane holds focus, so it wins the tab and the control stays focused.
		const [passageTab, questionTab] = tabs();
		expect(passageTab.getAttribute('aria-selected')).toBe('true');
		expect(questionTab.getAttribute('aria-selected')).toBe('false');
		expect(document.activeElement).toBe(toggle);
		expect(document.getElementById(passageTab.getAttribute('aria-controls')!)!.hidden).toBe(false);
		expect(document.getElementById(questionTab.getAttribute('aria-controls')!)!.hidden).toBe(true);
	});

	test('focus on a question control still selects the question tab', async () => {
		const state = reactiveProps({ leftPane: passageSnippet, children: questionSnippet, activeItemKey: 'section-1:q1:0' });
		const m = mountInto(SplitPaneResizer, state);
		mounted.push(m);
		current = m.host;
		await settle();

		state.activeItemKey = 'section-1:q2:1';
		await settle();
		const control = document.querySelector<HTMLElement>('.question-control')!;
		control.focus();

		await narrowViewportNow();

		const [passageTab, questionTab] = tabs();
		expect(passageTab.getAttribute('aria-selected')).toBe('false');
		expect(questionTab.getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(control);
	});

	test('no focus in either pane keeps the passage tab selected', async () => {
		const state = reactiveProps({ leftPane: passageSnippet, children: questionSnippet, activeItemKey: 'section-1:q1:0' });
		const m = mountInto(SplitPaneResizer, state);
		mounted.push(m);
		current = m.host;
		await settle();

		await narrowViewportNow();
		const [passageTab] = tabs();
		expect(passageTab.getAttribute('aria-selected')).toBe('true');
	});
});

describe('splitter value reporting', () => {
	test('without layout the reported range is the configured 25–75 and stepping works', async () => {
		const state = reactiveProps({ leftPane: passageSnippet, children: questionSnippet });
		const m = mountInto(SplitPaneResizer, state);
		mounted.push(m);
		current = m.host;
		await settle();

		const splitter = m.host.querySelector<HTMLElement>('[role="separator"]')!;
		expect(splitter.getAttribute('aria-valuemin')).toBe('25');
		expect(splitter.getAttribute('aria-valuemax')).toBe('75');
		expect(Number(splitter.getAttribute('aria-valuenow'))).toBe(50);
		press(splitter, 'ArrowRight');
		flushSync();
		expect(Number(splitter.getAttribute('aria-valuenow'))).toBe(52);
		press(splitter, 'End');
		flushSync();
		expect(Number(splitter.getAttribute('aria-valuenow'))).toBe(75);
		press(splitter, 'Home');
		flushSync();
		expect(Number(splitter.getAttribute('aria-valuenow'))).toBe(25);
	});
});
