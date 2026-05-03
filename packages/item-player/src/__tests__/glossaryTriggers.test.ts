/**
 * Tests for applyGlossaryTriggers using a minimal DOM mock.
 * We set up a lightweight global DOM before each test so the module
 * can call document.createElement, querySelectorAll, etc.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { applyGlossaryTriggers } from '../catalog/applyGlossaryTriggers.js';

// ---------------------------------------------------------------------------
// Minimal DOM bootstrap (no external deps)
// ---------------------------------------------------------------------------

type Attrs = Record<string, string>;
type EventMap = Record<string, ((...args: any[]) => void)[]>;

class FakeElement {
	tagName: string;
	className = '';
	textContent = '';
	innerHTML = '';
	style: Record<string, string> = {};
	children: FakeElement[] = [];
	parent: FakeElement | null = null;
	private attrs: Attrs = {};
	private events: EventMap = {};

	constructor(tag: string) {
		this.tagName = tag.toUpperCase();
	}

	setAttribute(name: string, value: string) { this.attrs[name] = value; }
	getAttribute(name: string) { return this.attrs[name] ?? null; }
	removeAttribute(name: string) { delete this.attrs[name]; }
	hasAttribute(name: string) { return name in this.attrs; }

	appendChild<T extends FakeElement>(child: T): T {
		// Detach from previous parent (matches real DOM behavior)
		if (child.parent && child.parent !== this) {
			child.parent.children = child.parent.children.filter((c) => c !== child);
		}
		child.parent = this;
		if (!this.children.includes(child)) {
			this.children.push(child);
		}
		return child;
	}

	insertBefore<T extends FakeElement>(newChild: T, ref: FakeElement | null): T {
		if (ref === null || !this.children.includes(ref)) {
			return this.appendChild(newChild);
		}
		const idx = this.children.indexOf(ref);
		newChild.parent = this;
		this.children.splice(idx, 0, newChild);
		return newChild;
	}

	remove() {
		if (this.parent) {
			this.parent.children = this.parent.children.filter((c) => c !== this);
			this.parent = null;
		}
	}

	addEventListener(type: string, handler: (...args: any[]) => void) {
		(this.events[type] ??= []).push(handler);
	}

	removeEventListener(type: string, handler: (...args: any[]) => void) {
		this.events[type] = (this.events[type] ?? []).filter((h) => h !== handler);
	}

	dispatchEvent(event: any): boolean {
		for (const h of this.events[event.type] ?? []) h(event);
		if (event.bubbles && this.parent) this.parent.dispatchEvent(event);
		return true;
	}

	focus() {}

	// querySelectorAll for [data-catalog-idref] and focusable selectors
	querySelectorAll(selector: string): FakeElement[] {
		const results: FakeElement[] = [];
		const visit = (el: FakeElement) => {
			if (matchesSelector(el, selector)) results.push(el);
			for (const c of el.children) visit(c);
		};
		for (const c of this.children) visit(c);
		return results;
	}

	// offsetParent: fake non-null so focusable elements are considered visible
	get offsetParent(): FakeElement | null { return this.parent ?? new FakeElement('body'); }

	get parentNode() { return this.parent; }
}

class FakeEvent {
	type: string;
	bubbles: boolean;
	composed: boolean;
	detail: any;
	defaultPrevented = false;
	key = '';
	shiftKey = false;

	constructor(type: string, opts: any = {}) {
		this.type = type;
		this.bubbles = opts.bubbles ?? false;
		this.composed = opts.composed ?? false;
		this.detail = opts.detail ?? {};
	}

	preventDefault() { this.defaultPrevented = true; }
}

class FakeDocument {
	createElement(tag: string): FakeElement {
		return new FakeElement(tag);
	}
}

// Simple CSS selector matching for our tests
function matchesSelector(el: FakeElement, selector: string): boolean {
	// [data-catalog-idref]
	if (selector === '[data-catalog-idref]') {
		return el.getAttribute('data-catalog-idref') !== null;
	}
	// focusable selector used by the focus trap
	if (selector.includes('button:not([disabled])')) {
		return el.tagName === 'BUTTON' && el.getAttribute('disabled') === null;
	}
	return false;
}

let savedDocument: any;
let savedCustomEvent: any;
let savedEvent: any;

function makeEnv() {
	savedDocument = (globalThis as any).document;
	savedCustomEvent = (globalThis as any).CustomEvent;
	savedEvent = (globalThis as any).Event;
	const doc = new FakeDocument();
	(globalThis as any).document = doc;
	(globalThis as any).CustomEvent = FakeEvent;
	(globalThis as any).Event = FakeEvent;
}

function clearEnv() {
	if (savedDocument !== undefined) (globalThis as any).document = savedDocument;
	else delete (globalThis as any).document;
	if (savedCustomEvent !== undefined) (globalThis as any).CustomEvent = savedCustomEvent;
	else delete (globalThis as any).CustomEvent;
	if (savedEvent !== undefined) (globalThis as any).Event = savedEvent;
	else delete (globalThis as any).Event;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const CATALOG_XML = `
<qti-catalog-info>
  <qti-card identifier="word-osmosis">
    <qti-card-entry usage="glossary-on-screen" xml:lang="en">
      <qti-html-content>Movement of water through a membrane.</qti-html-content>
    </qti-card-entry>
    <qti-card-entry usage="keyword-translation" xml:lang="es">
      <qti-html-content>ósmosis</qti-html-content>
    </qti-card-entry>
    <qti-card-entry usage="tts-pronunciation">
      <qti-html-content>oz-MOH-sis</qti-html-content>
    </qti-card-entry>
  </qti-card>
</qti-catalog-info>
`;

const ITEM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="glossary-test" title="Glossary Test" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  ${CATALOG_XML}
  <qti-item-body>
    <p>The process of <span data-catalog-idref="word-osmosis">osmosis</span> is important.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">True</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

function makeMockPlayer(pnp: any, catalog: Record<string, Record<string, string | null>> = {}) {
	return {
		getPnp: () => pnp,
		getCatalogEntry: (idref: string, usage: string, _lang?: string) => {
			return catalog[idref]?.[usage] ?? null;
		},
		getComponentRegistry: () => ({
			getTagNameForType: (_type: string) => null,
		}),
	} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyGlossaryTriggers', () => {
	beforeEach(() => makeEnv());
	afterEach(() => clearEnv());

	it('does nothing when pnp is undefined', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		applyGlossaryTriggers(container, makeMockPlayer(undefined));
		// No wrapper or button children should have been added
		expect(container.children.length).toBe(1);
		expect(container.children[0]).toBe(term);
	});

	it('does nothing when neither glossaryOnScreen nor keywordTranslation is active', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		container.appendChild(term);

		applyGlossaryTriggers(container, makeMockPlayer({ content: { glossaryOnScreen: false } }));
		expect(container.children.length).toBe(1);
	});

	it('wraps term in a .qti-catalog-term span and adds a trigger button when glossaryOnScreen', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const player = makeMockPlayer(
			{ content: { glossaryOnScreen: true } },
			{ 'word-osmosis': { 'glossary-on-screen': 'Movement of water.' } }
		);

		applyGlossaryTriggers(container, player);

		// The container's first child should now be the wrapper
		const wrapper = container.children[0];
		expect(wrapper.className).toBe('qti-catalog-term');
		// Wrapper should contain the original term + 1 trigger button
		expect(wrapper.children.length).toBe(2);
		const btn = wrapper.children[1];
		expect(btn.tagName).toBe('BUTTON');
		expect(btn.getAttribute('aria-label')).toBe('Show definition: osmosis');
		expect(btn.getAttribute('data-catalog-usage')).toBe('glossary-on-screen');
	});

	it('adds a keyword-translation trigger when keywordTranslation is active', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const player = makeMockPlayer(
			{ content: { keywordTranslation: { active: true, languageCode: 'es' } } },
			{ 'word-osmosis': { 'keyword-translation': 'ósmosis' } }
		);

		applyGlossaryTriggers(container, player);

		const wrapper = container.children[0];
		// Should have term + 1 kw-translation button
		const btn = wrapper.children.find((c: FakeElement) => c.getAttribute('data-catalog-usage') === 'keyword-translation');
		expect(btn).toBeDefined();
		expect((btn as FakeElement).getAttribute('aria-label')).toBe('Show definition: osmosis');
	});

	it('clicking a glossary trigger creates a popup with the entry HTML', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const player = makeMockPlayer(
			{ content: { glossaryOnScreen: true } },
			{ 'word-osmosis': { 'glossary-on-screen': 'Movement of water.' } }
		);

		applyGlossaryTriggers(container, player);

		const wrapper = container.children[0];
		const btn = wrapper.children[1];

		// Click opens popup
		btn.dispatchEvent(new FakeEvent('click', {}));

		// Wrapper should now have: term + triggerBtn + popup
		const popup = wrapper.children.find((c: FakeElement) => c.getAttribute('role') === 'dialog');
		expect(popup).toBeDefined();
		expect(popup!.getAttribute('aria-label')).toBe('osmosis');
		expect(popup!.getAttribute('aria-modal')).toBe('true');
	});

	it('clicking trigger again closes the open popup', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const player = makeMockPlayer(
			{ content: { glossaryOnScreen: true } },
			{ 'word-osmosis': { 'glossary-on-screen': 'Movement of water.' } }
		);

		applyGlossaryTriggers(container, player);
		const wrapper = container.children[0];
		const btn = wrapper.children[1];

		btn.dispatchEvent(new FakeEvent('click', {}));
		expect(wrapper.children.some((c: FakeElement) => c.getAttribute('role') === 'dialog')).toBe(true);

		btn.dispatchEvent(new FakeEvent('click', {}));
		expect(wrapper.children.some((c: FakeElement) => c.getAttribute('role') === 'dialog')).toBe(false);
	});

	it('does not open popup when catalog entry is null', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'unknown-term');
		term.textContent = 'unknown';
		container.appendChild(term);

		const player = makeMockPlayer({ content: { glossaryOnScreen: true } }, {});

		applyGlossaryTriggers(container, player);
		const wrapper = container.children[0];
		const btn = wrapper.children[1];
		btn.dispatchEvent(new FakeEvent('click', {}));

		expect(wrapper.children.some((c: FakeElement) => c.getAttribute('role') === 'dialog')).toBe(false);
	});

	it('fires qti-catalog-lookup CustomEvent for platform usages (tts-pronunciation)', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const firedEvents: any[] = [];
		container.addEventListener('qti-catalog-lookup', (e: any) => firedEvents.push(e));
		// Override addEventListener to track bubbled events from term
		const origDispatch = term.dispatchEvent.bind(term);
		term.dispatchEvent = (e: any) => {
			if (e.type === 'qti-catalog-lookup') firedEvents.push(e);
			return origDispatch(e);
		};

		const player = makeMockPlayer(
			{ content: { glossaryOnScreen: true } },
			{ 'word-osmosis': { 'glossary-on-screen': 'Movement of water.', 'tts-pronunciation': 'oz-MOH-sis' } }
		);

		applyGlossaryTriggers(container, player);

		const ttsFired = firedEvents.find((e) => e.detail?.usage === 'tts-pronunciation');
		expect(ttsFired).toBeDefined();
		expect(ttsFired.detail.idref).toBe('word-osmosis');
		expect(ttsFired.detail.html).toBe('oz-MOH-sis');
		// No popup was created for tts-pronunciation
		const wrapper = container.children[0];
		expect(wrapper.children.some((c: FakeElement) => c.getAttribute('role') === 'dialog')).toBe(false);
	});

	it('handles multiple catalog terms independently', () => {
		const container = new FakeElement('div') as any;

		const term1 = new FakeElement('span') as any;
		term1.setAttribute('data-catalog-idref', 'word-osmosis');
		term1.textContent = 'osmosis';

		const term2 = new FakeElement('span') as any;
		term2.setAttribute('data-catalog-idref', 'word-mitosis');
		term2.textContent = 'mitosis';

		container.appendChild(term1);
		container.appendChild(term2);

		const player = makeMockPlayer(
			{ content: { glossaryOnScreen: true } },
			{
				'word-osmosis': { 'glossary-on-screen': 'Water movement.' },
				'word-mitosis': { 'glossary-on-screen': 'Cell division.' },
			}
		);

		applyGlossaryTriggers(container, player);

		// Two wrappers should exist
		expect(container.children.length).toBe(2);
		expect(container.children[0].className).toBe('qti-catalog-term');
		expect(container.children[1].className).toBe('qti-catalog-term');
	});
});
