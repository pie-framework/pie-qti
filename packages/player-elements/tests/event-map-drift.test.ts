/**
 * Runtime walk of the drift pins: scans each element facade's runtime source
 * for the events it actually dispatches and pins the result against the
 * reviewed lists in tests/event-map-contracts.ts. Those lists, in turn, are
 * type-pinned against the event maps the public facade (src/public/api.ts)
 * exports — so a runtime event cannot ship without its contract, and a
 * contract event cannot outlive its runtime dispatch.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
	ASSESSMENT_PLAYER_EVENTS,
	ITEM_PLAYER_EVENTS,
	SECTION_PLAYER_EVENTS,
} from './event-map-contracts.js';

/**
 * Event name literals at dispatch sites: `new CustomEvent<Detail>('name', …)`,
 * `new CustomEvent('name', …)` and the section element's
 * `#dispatchSectionEvent('name', …)` helper. Generic type arguments carry no
 * nested generics here, so `[^>]*` bounds them.
 */
const DISPATCHED_EVENT_PATTERN = /(?:new CustomEvent(?:<[^>]*>)?|#dispatchSectionEvent)\(\s*'([^']+)'/g;

function dispatchedEvents(source: string): string[] {
	return [...new Set([...source.matchAll(DISPATCHED_EVENT_PATTERN)].map((match) => match[1]!))].sort();
}

function readSource(url: URL): string {
	return readFileSync(url, 'utf8');
}

describe('runtime dispatches match the published event contracts', () => {
	test('the assessment player element dispatches exactly its contract events', () => {
		const source = readSource(new URL('../src/elements/QtiAssessmentPlayerElement.ts', import.meta.url));
		expect(dispatchedEvents(source)).toEqual([...ASSESSMENT_PLAYER_EVENTS].sort());
	});

	test('the section player element base dispatches exactly its contract events', () => {
		const source = readSource(new URL('../src/elements/QtiSectionPlayerSplitPaneElement.ts', import.meta.url));
		expect(dispatchedEvents(source)).toEqual([...SECTION_PLAYER_EVENTS].sort());
	});

	test('the vertical section layout adds no events of its own', () => {
		const source = readSource(new URL('../src/elements/QtiSectionPlayerVerticalElement.ts', import.meta.url));
		expect(dispatchedEvents(source)).toEqual([]);
	});

	test('the item player element dispatches exactly its contract events', () => {
		// The published item element is @pie-qti/item-player's element class;
		// resolve its package entry and walk the source next to it.
		const packageEntry = import.meta.resolve('@pie-qti/item-player/element-class');
		const source = readSource(new URL('../src/element-class.ts', packageEntry));
		expect(dispatchedEvents(source)).toEqual([...ITEM_PLAYER_EVENTS].sort());
	});
});
