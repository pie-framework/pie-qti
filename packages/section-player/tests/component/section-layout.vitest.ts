import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import RubricDisplay from '../../src/components/RubricDisplay.svelte';
import SplitPaneResizer from '../../src/components/SplitPaneResizer.svelte';
import type { QtiSharedHtmlBlock } from '../../src/contracts/index.js';
import { mountInto, press, settle, type Mounted } from './helpers';
import { reactiveProps } from './reactive-props.svelte';

const mounted: Mounted[] = [];
const originalMatchMedia = window.matchMedia;

/** jsdom has neither ResizeObserver nor layout: drive the stacking breakpoint through matchMedia. */
function viewportIsNarrow(narrow: boolean) {
	window.matchMedia = ((query: string) => ({
		matches: narrow,
		media: query,
		onchange: null,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
}

const passageSnippet = createRawSnippet(() => ({ render: () => '<p class="passage-text">The water cycle.</p>' }));
const itemSnippet = createRawSnippet(() => ({ render: () => '<p class="item-text">Which process forms clouds?</p>' }));

async function renderSplit(props: Record<string, unknown> = {}) {
	const state = reactiveProps({ leftPane: passageSnippet, children: itemSnippet, ...props });
	const m = mountInto(SplitPaneResizer, state);
	mounted.push(m);
	await settle();
	return { m, state };
}

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	window.matchMedia = originalMatchMedia;
});

describe('SplitPaneResizer', () => {
	test('wide: two labelled panes and a keyboard splitter that controls both', async () => {
		viewportIsNarrow(false);
		const { m } = await renderSplit();

		expect(m.host.querySelector('[role="tablist"]')).toBeNull();
		const splitter = m.host.querySelector('[role="separator"]')!;
		const controlled = splitter.getAttribute('aria-controls')!.split(' ');
		expect(controlled).toHaveLength(2);
		for (const id of controlled) expect(document.getElementById(id)).not.toBeNull();
		expect(m.host.querySelector('.pane-left')?.getAttribute('aria-label')).toBe('Passage');
		expect(m.host.querySelector('.pane-right')?.getAttribute('aria-label')).toBe('Question');

		const before = Number(splitter.getAttribute('aria-valuenow'));
		press(splitter, 'ArrowRight');
		flushSync();
		expect(Number(splitter.getAttribute('aria-valuenow'))).toBe(before + 2);
	});

	test('narrow: a Passage/Question tab switch replaces the stacked panes', async () => {
		viewportIsNarrow(true);
		const { m } = await renderSplit();

		expect(m.host.querySelector('[role="separator"]')).toBeNull();
		const tabs = Array.from(m.host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
		expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Passage', 'Question']);
		expect(m.host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Passage and question');

		const [passageTab, questionTab] = tabs as [HTMLButtonElement, HTMLButtonElement];
		const passagePanel = document.getElementById(passageTab.getAttribute('aria-controls')!)!;
		const questionPanel = document.getElementById(questionTab.getAttribute('aria-controls')!)!;
		expect(passagePanel.getAttribute('role')).toBe('tabpanel');
		expect(passagePanel.getAttribute('aria-labelledby')).toBe(passageTab.id);
		expect(questionPanel.getAttribute('aria-labelledby')).toBe(questionTab.id);

		// The passage reads first; only the selected panel is exposed.
		expect(passageTab.getAttribute('aria-selected')).toBe('true');
		expect(passageTab.tabIndex).toBe(0);
		expect(questionTab.tabIndex).toBe(-1);
		expect(passagePanel.hidden).toBe(false);
		expect(questionPanel.hidden).toBe(true);
	});

	test('arrow keys, Home and End move between the tabs and select them', async () => {
		viewportIsNarrow(true);
		const { m } = await renderSplit();
		const [passageTab, questionTab] = Array.from(m.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')) as [
			HTMLButtonElement,
			HTMLButtonElement,
		];

		passageTab.focus();
		press(passageTab, 'ArrowRight');
		await settle();
		expect(questionTab.getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(questionTab);
		expect(document.getElementById(questionTab.getAttribute('aria-controls')!)!.hidden).toBe(false);

		press(questionTab, 'Home');
		await settle();
		expect(passageTab.getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(passageTab);

		press(passageTab, 'End');
		await settle();
		expect(questionTab.getAttribute('aria-selected')).toBe('true');

		press(questionTab, 'ArrowRight');
		await settle();
		expect(passageTab.getAttribute('aria-selected')).toBe('true');
	});

	test('a newly presented item selects the question tab', async () => {
		viewportIsNarrow(true);
		const { m, state } = await renderSplit({ activeItemKey: 'section:q1:0' });
		const questionTab = m.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!;
		expect(questionTab.getAttribute('aria-selected')).toBe('false');

		state.activeItemKey = 'section:q2:1';
		await settle();
		expect(questionTab.getAttribute('aria-selected')).toBe('true');
	});

	test('revealItemPane selects the question tab and returns the pane to focus', async () => {
		viewportIsNarrow(true);
		const { m } = await renderSplit();
		const reveal = m.instance.revealItemPane as () => Promise<HTMLElement | null>;

		const pane = await reveal();
		expect(pane).not.toBeNull();
		expect(pane!.hidden).toBe(false);
		pane!.focus();
		expect(document.activeElement).toBe(pane);
		expect(m.host.querySelectorAll('[role="tab"]')[1]!.getAttribute('aria-selected')).toBe('true');
	});

	test('two instances never share element ids', async () => {
		viewportIsNarrow(true);
		const first = await renderSplit();
		const second = await renderSplit();
		const ids = [...first.m.host.querySelectorAll('[id]'), ...second.m.host.querySelectorAll('[id]')].map((el) => el.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

function passage(identifier: string, extra: Partial<QtiSharedHtmlBlock> = {}): QtiSharedHtmlBlock {
	return {
		identifier,
		kind: 'passage',
		scope: 'section',
		view: ['candidate'],
		rawHtml: '<p>Passage text.</p>',
		...extra,
	};
}

describe('RubricDisplay passage headings', () => {
	test('an authored title heads the passage', async () => {
		const m = mountInto(RubricDisplay, { passages: [passage('p1', { title: 'The Water Cycle' })] });
		mounted.push(m);
		await settle();

		const article = m.host.querySelector('article.passage')!;
		const heading = m.host.querySelector('h3')!;
		expect(heading.textContent?.trim()).toBe('The Water Cycle');
		expect(article.getAttribute('aria-labelledby')).toBe(heading.id);
	});

	test('untitled passages get a neutral label, numbered when there are several', async () => {
		const single = mountInto(RubricDisplay, { passages: [passage('p1')] });
		mounted.push(single);
		await settle();
		expect(single.host.querySelector('h3')?.textContent?.trim()).toBe('Passage');
		expect(single.host.textContent).not.toContain('Reading Passage');

		const several = mountInto(RubricDisplay, { passages: [passage('p1'), passage('p2')] });
		mounted.push(several);
		await settle();
		expect(Array.from(several.host.querySelectorAll('h3')).map((h) => h.textContent?.trim())).toEqual([
			'Passage 1',
			'Passage 2',
		]);
	});

	test('the heading level follows the page outline', async () => {
		const m = mountInto(RubricDisplay, { passages: [passage('p1')], headingLevel: 2 });
		mounted.push(m);
		await settle();
		expect(m.host.querySelector('h2')?.textContent?.trim()).toBe('Passage');
		expect(m.host.querySelector('h4')).toBeNull();
	});

	test('each passage collapses on its own', async () => {
		const m = mountInto(RubricDisplay, { passages: [passage('p1'), passage('p2')] });
		mounted.push(m);
		await settle();

		const [firstToggle, secondToggle] = Array.from(m.host.querySelectorAll<HTMLButtonElement>('.passage-toggle')) as [
			HTMLButtonElement,
			HTMLButtonElement,
		];
		firstToggle.click();
		await settle();
		expect(firstToggle.getAttribute('aria-expanded')).toBe('false');
		expect(secondToggle.getAttribute('aria-expanded')).toBe('true');
		expect(m.host.querySelectorAll('.passage-content')).toHaveLength(1);
	});

	test('every passage toggle is named for its own passage', async () => {
		const several = mountInto(RubricDisplay, {
			passages: [passage('p1', { title: 'The Water Cycle' }), passage('p2')],
		});
		mounted.push(several);
		await settle();

		const toggles = Array.from(several.host.querySelectorAll<HTMLButtonElement>('.passage-toggle'));
		const names = toggles.map((toggle) => toggle.getAttribute('aria-label'));
		expect(names).toEqual(['The Water Cycle — Collapse passage', 'Passage 2 — Collapse passage']);
		expect(new Set(names).size).toBe(names.length);

		// The name follows the state: a collapsed passage offers to expand again.
		toggles[0]!.click();
		await settle();
		expect(toggles[0]!.getAttribute('aria-expanded')).toBe('false');
		expect(toggles[0]!.getAttribute('aria-label')).toBe('The Water Cycle — Expand passage');

		// A lone untitled passage still gets a sensible name from its neutral heading.
		const single = mountInto(RubricDisplay, { passages: [passage('p1')] });
		mounted.push(single);
		await settle();
		expect(single.host.querySelector('.passage-toggle')?.getAttribute('aria-label')).toBe('Passage — Collapse passage');
	});

	test('a provider that answers a missing key with the key never leaks it into a name', async () => {
		// Hosts hand the section its provider; one that only holds a narrow catalog
		// answers a lookup it cannot serve with the key itself. The toggle's name
		// composes heading plus verb, so a raw key there would read as the verb.
		const keyEchoing = {
			getLocale: () => 'nl-NL',
			setLocale: () => {},
			t: (key: string) => key,
		};
		const m = mountInto(RubricDisplay, { passages: [passage('p1')], i18n: keyEchoing });
		mounted.push(m);
		await settle();

		const toggle = m.host.querySelector('.passage-toggle')!;
		expect(toggle.getAttribute('aria-label')).toBe('Passage — Collapse passage');
		expect(m.host.textContent).not.toContain('assessment.collapsePassage');
	});

	test('passage and rubric content carry the normalized content base', async () => {
		const m = mountInto(RubricDisplay, {
			passages: [passage('p1')],
			rubricBlocks: [{ identifier: 'r1', kind: 'rubric', scope: 'section', view: ['candidate'], rawHtml: '<p>Rubric</p>' }],
		});
		mounted.push(m);
		await settle();
		expect(m.host.querySelector('.passage-content')?.classList.contains('pie-qti-content')).toBe(true);
		expect(m.host.querySelector('.rubric-block')?.classList.contains('pie-qti-content')).toBe(true);
	});
});
