import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The item player element is the item player package's; a stand-in keeps these tests on
// the section's own behaviour.
vi.mock('@pie-qti/item-player/element', () => {
	if (!customElements.get('pie-qti-item-player')) {
		customElements.define('pie-qti-item-player', class extends HTMLElement {});
	}
	return {};
});

import SectionPlayerSplitPane from '../../src/components/SectionPlayerSplitPane.svelte';
import SectionPlayerVertical from '../../src/components/SectionPlayerVertical.svelte';
import type { ResolvedQtiSectionComposition } from '../../src/contracts/index.js';
import { resolveQtiSectionComposition } from '../../src/composition/resolveQtiSectionComposition.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const originalMatchMedia = window.matchMedia;
let assessmentCounter = 0;

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

const ITEM_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="q1" title="Q1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

interface CompositionHost {
	onActiveItemChange?: (event: unknown) => void;
	onSnapshotChange?: (snapshot: unknown) => void;
	onResponseDelta?: (event: unknown) => void;
}

function composition(host: CompositionHost = {}): ResolvedQtiSectionComposition {
	assessmentCounter += 1;
	return resolveQtiSectionComposition({
		assessmentId: `assessment-${assessmentCounter}`,
		host,
		section: {
			identifier: 'section-1',
			itemRefs: [{ identifier: 'q1', title: 'Question one', itemXml: ITEM_XML }],
			sharedContext: {
				passages: [
					{ identifier: 'p1', kind: 'passage', scope: 'section', view: ['candidate'], title: 'The Water Cycle', rawHtml: '<p>The water cycle.</p>' },
				],
				stimuli: [],
				rubricBlocks: [
					{ identifier: 'r1', kind: 'rubric', scope: 'section', view: ['candidate'], rawHtml: '<p>Read carefully.</p>' },
				],
				testFeedback: [],
				stylesheets: [],
				catalogSources: [],
				assetDiagnostics: [],
			},
		},
	});
}

async function waitFor<T>(find: () => T | null | undefined, timeoutMs = 2000): Promise<T> {
	const start = Date.now();
	for (;;) {
		await settle();
		const found = find();
		if (found) return found;
		if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for the section to render');
	}
}

/** The stand-in item player element the item renderer attached its response listener to. */
async function itemPlayerOf(host: HTMLElement): Promise<Element> {
	return waitFor(() => host.querySelector('pie-qti-item-player'));
}

function responseChange(responseId: string, value: unknown) {
	return new CustomEvent('response-change', { bubbles: true, detail: { responseId, value } });
}

beforeEach(() => {
	viewportIsNarrow(false);
});

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	window.matchMedia = originalMatchMedia;
});

describe('SectionPlayerVertical', () => {
	test('a passage, then a question region holding the rubric and the item', async () => {
		const m = mountInto(SectionPlayerVertical, { composition: composition() });
		mounted.push(m);
		await itemPlayerOf(m.host);

		const root = m.host.querySelector<HTMLElement>('.section-player-vertical')!;
		expect(root.classList.contains('pie-qti-chrome')).toBe(true);

		const pane = m.host.querySelector<HTMLElement>('.section-player-item-pane')!;
		expect(pane.getAttribute('role')).toBe('region');
		expect(pane.getAttribute('aria-label')).toBe('Question');
		expect(pane.getAttribute('tabindex')).toBe('-1');

		// Reading order: the passage section comes before the question region…
		const passageSection = m.host.querySelector('section.passage-section')!;
		expect(passageSection.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		// …and the region holds the rubric block before the item.
		const rubric = pane.querySelector('.rubric-block')!;
		const player = pane.querySelector('pie-qti-item-player')!;
		expect(rubric.compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(passageSection.contains(rubric)).toBe(false);
	});

	test('passage and item titles head at the given heading level', async () => {
		const m = mountInto(SectionPlayerVertical, { composition: composition() });
		mounted.push(m);
		await itemPlayerOf(m.host);
		expect(m.host.querySelector('h3.passage-title')?.textContent?.trim()).toBe('The Water Cycle');
		expect(m.host.querySelector('h3.item-title')?.textContent?.trim()).toBe('Question one');

		const above = mountInto(SectionPlayerVertical, { composition: composition(), headingLevel: 2 });
		mounted.push(above);
		await itemPlayerOf(above.host);
		expect(above.host.querySelector('h2.passage-title')).not.toBeNull();
		expect(above.host.querySelector('h2.item-title')).not.toBeNull();
	});

	test('the question region is reported ready and receives focus', async () => {
		const onItemPaneReady = vi.fn();
		const m = mountInto(SectionPlayerVertical, { composition: composition(), onItemPaneReady });
		mounted.push(m);
		const pane = await waitFor(() => m.host.querySelector<HTMLElement>('.section-player-item-pane'));
		expect(onItemPaneReady).toHaveBeenCalledWith(pane);

		const focus = m.instance.focusActiveItem as (options?: FocusOptions) => Promise<boolean>;
		expect(await focus()).toBe(true);
		expect(document.activeElement).toBe(pane);
	});

	test('item response changes reach the host callback with the item identifier', async () => {
		const onResponseChange = vi.fn();
		const m = mountInto(SectionPlayerVertical, { composition: composition(), onResponseChange });
		mounted.push(m);
		const player = (await itemPlayerOf(m.host)) as HTMLElement;
		player.dispatchEvent(responseChange('RESPONSE', 'A'));
		flushSync();
		expect(onResponseChange).toHaveBeenCalledWith('q1', 'RESPONSE', 'A');
	});

	test('the active item and the snapshot are announced to the runtime host', async () => {
		const host: CompositionHost = { onActiveItemChange: vi.fn(), onSnapshotChange: vi.fn() };
		const m = mountInto(SectionPlayerVertical, { composition: composition(host) });
		mounted.push(m);
		await itemPlayerOf(m.host);
		expect(host.onActiveItemChange).toHaveBeenCalledWith({
			sectionIdentifier: 'section-1',
			itemIdentifier: 'q1',
			itemIndex: 0,
			itemCount: 1,
		});
		expect(host.onSnapshotChange).toHaveBeenCalledTimes(1);
	});

	test('the display settings tool is offered', async () => {
		const m = mountInto(SectionPlayerVertical, { composition: composition() });
		mounted.push(m);
		await itemPlayerOf(m.host);
		expect(m.host.querySelector('[data-testid="section-display-settings-button"]')).not.toBeNull();
	});
});

describe('SectionPlayerSplitPane', () => {
	test('wide: a passage pane before a question pane with rubric and item', async () => {
		const m = mountInto(SectionPlayerSplitPane, { composition: composition() });
		mounted.push(m);
		await itemPlayerOf(m.host);

		const left = m.host.querySelector<HTMLElement>('.pane-left')!;
		const right = m.host.querySelector<HTMLElement>('.pane-right')!;
		expect(left.getAttribute('aria-label')).toBe('Passage');
		expect(right.getAttribute('aria-label')).toBe('Question');

		// Reading order: passage, then rubric block, then item.
		const passage = left.querySelector('article.passage')!;
		const rubric = right.querySelector('.rubric-block')!;
		const player = right.querySelector('pie-qti-item-player')!;
		expect(passage.compareDocumentPosition(rubric) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(rubric.compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(left.querySelector('[role="separator"]')).toBeNull();
		expect(m.host.querySelector('[role="separator"]')).not.toBeNull();
	});

	test('wide: the question pane is reported ready and receives focus', async () => {
		const onItemPaneReady = vi.fn();
		const m = mountInto(SectionPlayerSplitPane, { composition: composition(), onItemPaneReady });
		mounted.push(m);
		const pane = await waitFor(() => m.host.querySelector<HTMLElement>('.pane-right'));
		expect(onItemPaneReady).toHaveBeenCalledWith(pane);

		const focus = m.instance.focusActiveItem as (options?: FocusOptions) => Promise<boolean>;
		expect(await focus()).toBe(true);
		expect(document.activeElement).toBe(pane);
	});

	test('item response changes reach the host callback with the item identifier', async () => {
		const onResponseChange = vi.fn();
		const m = mountInto(SectionPlayerSplitPane, { composition: composition(), onResponseChange });
		mounted.push(m);
		const player = (await itemPlayerOf(m.host)) as HTMLElement;
		player.dispatchEvent(responseChange('RESPONSE', 'A'));
		flushSync();
		expect(onResponseChange).toHaveBeenCalledWith('q1', 'RESPONSE', 'A');
	});

	test('stacked: Passage and Question tabs replace the panes, question keeps the item', async () => {
		viewportIsNarrow(true);
		const m = mountInto(SectionPlayerSplitPane, { composition: composition() });
		mounted.push(m);
		await itemPlayerOf(m.host);

		const tabs = Array.from(m.host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
		expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Passage', 'Question']);

		const [passageTab, questionTab] = tabs as [HTMLButtonElement, HTMLButtonElement];
		const passagePanel = document.getElementById(passageTab.getAttribute('aria-controls')!)!;
		const questionPanel = document.getElementById(questionTab.getAttribute('aria-controls')!)!;
		expect(passagePanel.querySelector('article.passage')).not.toBeNull();
		expect(questionPanel.querySelector('.rubric-block')).not.toBeNull();
		expect(questionPanel.querySelector('pie-qti-item-player')).not.toBeNull();

		const focus = m.instance.focusActiveItem as (options?: FocusOptions) => Promise<boolean>;
		expect(await focus()).toBe(true);
		expect(questionTab.getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(questionPanel);
	});

	test('the active item and the snapshot are announced to the runtime host', async () => {
		const host: CompositionHost = { onActiveItemChange: vi.fn(), onSnapshotChange: vi.fn() };
		const m = mountInto(SectionPlayerSplitPane, { composition: composition(host) });
		mounted.push(m);
		await itemPlayerOf(m.host);
		expect(host.onActiveItemChange).toHaveBeenCalledWith({
			sectionIdentifier: 'section-1',
			itemIdentifier: 'q1',
			itemIndex: 0,
			itemCount: 1,
		});
		expect(host.onSnapshotChange).toHaveBeenCalledTimes(1);
	});

	test('the display settings tool is offered', async () => {
		const m = mountInto(SectionPlayerSplitPane, { composition: composition() });
		mounted.push(m);
		await itemPlayerOf(m.host);
		expect(m.host.querySelector('[data-testid="section-display-settings-button"]')).not.toBeNull();
	});
});
