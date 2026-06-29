import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { applyGlossaryTriggers } from '../../src/catalog/applyGlossaryTriggers.js';

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

	setAttribute(name: string, value: string) {
		this.attrs[name] = value;
	}

	getAttribute(name: string) {
		return this.attrs[name] ?? null;
	}

	removeAttribute(name: string) {
		delete this.attrs[name];
	}

	hasAttribute(name: string) {
		return name in this.attrs;
	}

	appendChild<T extends FakeElement>(child: T): T {
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
		if (newChild.parent) {
			newChild.parent.children = newChild.parent.children.filter((c) => c !== newChild);
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

	closest(selector: string): FakeElement | null {
		let current: FakeElement | null = this;
		while (current) {
			if (matchesSelector(current, selector)) return current;
			current = current.parent;
		}
		return null;
	}

	focus() {}

	querySelectorAll(selector: string): FakeElement[] {
		const results: FakeElement[] = [];
		const visit = (el: FakeElement) => {
			if (matchesSelector(el, selector)) results.push(el);
			for (const c of el.children) visit(c);
		};
		for (const c of this.children) visit(c);
		return results;
	}

	get offsetParent(): FakeElement | null {
		return this.parent ?? new FakeElement('body');
	}

	get parentNode() {
		return this.parent;
	}
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

	preventDefault() {
		this.defaultPrevented = true;
	}
}

class FakeDocument {
	createElement(tag: string): FakeElement {
		return new FakeElement(tag);
	}
}

function matchesSelector(el: FakeElement, selector: string): boolean {
	if (selector === '[data-catalog-idref]') {
		return el.getAttribute('data-catalog-idref') !== null;
	}
	if (selector === '[data-stimulus-idref]') {
		return el.getAttribute('data-stimulus-idref') !== null;
	}
	if (selector === '.qti-catalog-term') {
		return el.className.split(/\s+/).includes('qti-catalog-term');
	}
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
	(globalThis as any).document = new FakeDocument();
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

function makeMockPlayer(pnp: any, catalog: Record<string, Record<string, string | null>> = {}) {
	return {
		getPnp: () => pnp,
		getCatalogEntry: (idref: string, usage: string, _lang?: string, _options?: any) => {
			return catalog[idref]?.[usage] ?? null;
		},
		getComponentRegistry: () => ({
			getTagNameForType: (_type: string) => null,
		}),
	} as any;
}

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

		const wrapper = container.children[0];
		expect(wrapper.className).toBe('qti-catalog-term');
		expect(wrapper.children.length).toBe(2);
		const btn = wrapper.children[1];
		expect(btn.tagName).toBe('BUTTON');
		expect(btn.getAttribute('aria-label')).toBe('Show definition: osmosis');
		expect(btn.getAttribute('data-catalog-usage')).toBe('glossary-on-screen');
	});

	it('cleans previously injected triggers before rebinding', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		applyGlossaryTriggers(
			container,
			makeMockPlayer({ content: { glossaryOnScreen: true } }, { 'word-osmosis': { 'glossary-on-screen': 'Definition.' } })
		);
		applyGlossaryTriggers(
			container,
			makeMockPlayer({ content: { keywordTranslation: { active: true, languageCode: 'es' } } }, { 'word-osmosis': { 'keyword-translation': 'osmosis' } })
		);

		expect(container.children.length).toBe(1);
		const wrapper = container.children[0];
		expect(wrapper.className).toBe('qti-catalog-term');
		const buttons = wrapper.children.filter((child: FakeElement) => child.tagName === 'BUTTON');
		expect(buttons.length).toBe(1);
		expect(buttons[0].getAttribute('data-catalog-usage')).toBe('keyword-translation');
	});

	it('adds a keyword-translation trigger when keywordTranslation is active', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const player = makeMockPlayer(
			{ content: { keywordTranslation: { active: true, languageCode: 'es' } } },
			{ 'word-osmosis': { 'keyword-translation': 'osmosis' } }
		);

		applyGlossaryTriggers(container, player);

		const wrapper = container.children[0];
		const btn = wrapper.children.find((c: FakeElement) => c.getAttribute('data-catalog-usage') === 'keyword-translation');
		expect(btn).toBeDefined();
		expect((btn as FakeElement).getAttribute('aria-label')).toBe('Show translation: osmosis');
	});

	it('adds an illustrated glossary trigger when illustratedGlossary is active', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const player = makeMockPlayer(
			{ content: { illustratedGlossary: true } },
			{ 'word-osmosis': { 'illustrated-glossary': '<img src="osmosis.png" alt="Osmosis diagram">' } }
		);

		applyGlossaryTriggers(container, player);

		const wrapper = container.children[0];
		const btn = wrapper.children.find((c: FakeElement) => c.getAttribute('data-catalog-usage') === 'illustrated-glossary');
		expect(btn).toBeDefined();
		expect((btn as FakeElement).getAttribute('aria-label')).toBe('Show illustrated glossary: osmosis');
		expect((btn as FakeElement).textContent).toBe('I');
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
		btn.dispatchEvent(new FakeEvent('click', {}));

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

	it('does not auto-emit platform catalog supports on render', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);

		const firedEvents: any[] = [];
		container.addEventListener('qti-catalog-lookup', (e: any) => firedEvents.push(e));
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
		expect(ttsFired).toBeUndefined();
		const wrapper = container.children[0];
		expect(wrapper.children.some((c: FakeElement) => c.getAttribute('role') === 'dialog')).toBe(false);
	});

	it('emits host catalog events only from active user-triggered support buttons', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);
		const firedEvents: any[] = [];
		container.addEventListener('qti-catalog-lookup', (e: any) => firedEvents.push(e));
		const player = makeMockPlayer(
			{ content: { catalogSupports: { ttsPronunciation: true } } },
			{ 'word-osmosis': { 'tts-pronunciation': 'oz-MOH-sis' } }
		);

		applyGlossaryTriggers(container, player);
		expect(firedEvents.length).toBe(0);
		const wrapper = container.children[0];
		const btn = wrapper.children.find((c: FakeElement) => c.getAttribute('data-catalog-usage') === 'tts-pronunciation');
		expect(btn).toBeDefined();
		btn!.dispatchEvent(new FakeEvent('click', { bubbles: true, composed: true }));

		expect(firedEvents[0]?.detail).toEqual({
			idref: 'word-osmosis',
			usage: 'tts-pronunciation',
			html: 'oz-MOH-sis',
			content: 'oz-MOH-sis',
			languageCode: undefined,
		});
	});

	it('emits host-defined catalog support events with sanitized player-provided content', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);
		const firedEvents: any[] = [];
		container.addEventListener('qti-catalog-lookup', (e: any) => firedEvents.push(e));
		const player = makeMockPlayer(
			{ content: { catalogSupports: { 'custom-audio': true } } },
			{ 'word-osmosis': { 'custom-audio': '<audio src="safe.mp3"></audio>' } }
		);

		applyGlossaryTriggers(container, player);
		expect(firedEvents.length).toBe(0);
		const wrapper = container.children[0];
		const btn = wrapper.children.find((c: FakeElement) => c.getAttribute('data-catalog-usage') === 'custom-audio');
		expect(btn).toBeDefined();
		expect(btn!.getAttribute('aria-label')).toBe('Request custom audio: osmosis');

		btn!.dispatchEvent(new FakeEvent('click', { bubbles: true, composed: true }));

		expect(firedEvents[0]?.detail).toEqual({
			idref: 'word-osmosis',
			usage: 'custom-audio',
			html: '<audio src="safe.mp3"></audio>',
			content: '<audio src="safe.mp3"></audio>',
			languageCode: undefined,
		});
	});

	it('passes host-defined catalog support language preferences into lookup', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);
		const firedEvents: any[] = [];
		container.addEventListener('qti-catalog-lookup', (e: any) => firedEvents.push(e));
		const lookupCalls: any[] = [];
		const player = {
			getPnp: () => ({ content: { catalogSupports: { 'custom-audio': { active: true, languageCode: 'es' } } } }),
			getCatalogEntry: (idref: string, usage: string, lang?: string) => {
				lookupCalls.push({ idref, usage, lang });
				return lang === 'es' ? '<audio src="osmosis-es.mp3"></audio>' : null;
			},
			getComponentRegistry: () => ({
				getTagNameForType: (_type: string) => null,
			}),
		} as any;

		applyGlossaryTriggers(container, player);
		const wrapper = container.children[0];
		const btn = wrapper.children.find((c: FakeElement) => c.getAttribute('data-catalog-usage') === 'custom-audio');

		expect(btn).toBeDefined();
		expect(lookupCalls[0]).toEqual({ idref: 'word-osmosis', usage: 'custom-audio', lang: 'es' });
		btn!.dispatchEvent(new FakeEvent('click', { bubbles: true, composed: true }));
		expect(firedEvents[0]?.detail.languageCode).toBe('es');
		expect(firedEvents[0]?.detail.html).toBe('<audio src="osmosis-es.mp3"></audio>');
	});

	it('does not expose host-defined catalog support UI for unsafe usage names', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);
		const player = makeMockPlayer(
			{ content: { catalogSupports: { 'javascript:alert(1)': true } } },
			{ 'word-osmosis': { 'javascript:alert(1)': 'unsafe' } }
		);

		applyGlossaryTriggers(container, player);

		expect(container.children.length).toBe(1);
		expect(container.children[0]).toBe(term);
	});

	it('does not route built-in popup usages as host-defined catalog supports', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);
		const player = makeMockPlayer(
			{ content: { catalogSupports: { 'glossary-on-screen': true } } },
			{ 'word-osmosis': { 'glossary-on-screen': 'Definition.' } }
		);

		applyGlossaryTriggers(container, player);

		expect(container.children.length).toBe(1);
		expect(container.children[0]).toBe(term);
	});

	it('does not duplicate standard support buttons when dashed and camelCase keys are both present', () => {
		const container = new FakeElement('div') as any;
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'word-osmosis');
		term.textContent = 'osmosis';
		container.appendChild(term);
		const player = makeMockPlayer(
			{ content: { catalogSupports: { ttsPronunciation: true, 'tts-pronunciation': true } } },
			{ 'word-osmosis': { 'tts-pronunciation': 'oz-MOH-sis' } }
		);

		applyGlossaryTriggers(container, player);
		const wrapper = container.children[0];
		const buttons = wrapper.children.filter(
			(c: FakeElement) => c.getAttribute('data-catalog-usage') === 'tts-pronunciation'
		);

		expect(buttons.length).toBe(1);
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

		expect(container.children.length).toBe(2);
		expect(container.children[0].className).toBe('qti-catalog-term');
		expect(container.children[1].className).toBe('qti-catalog-term');
	});

	it('passes stimulus scope when a catalog term is inside a rendered stimulus wrapper', () => {
		const container = new FakeElement('div') as any;
		const stimulus = new FakeElement('section') as any;
		stimulus.setAttribute('data-stimulus-idref', 'passage_1');
		const term = new FakeElement('span') as any;
		term.setAttribute('data-catalog-idref', 'term_delta');
		term.textContent = 'delta';
		stimulus.appendChild(term);
		container.appendChild(stimulus);
		const lookupCalls: any[] = [];
		const player = {
			getPnp: () => ({ content: { glossaryOnScreen: true } }),
			getCatalogEntry: (idref: string, usage: string, lang?: string, options?: any) => {
				lookupCalls.push({ idref, usage, lang, options });
				return options?.stimulusIdentifier === 'passage_1' ? 'Stimulus definition' : 'Item definition';
			},
			getComponentRegistry: () => ({
				getTagNameForType: (_type: string) => null,
			}),
		} as any;

		applyGlossaryTriggers(container, player);
		const wrapper = stimulus.children[0];
		const btn = wrapper.children.find((child: FakeElement) => child.tagName === 'BUTTON');
		btn!.dispatchEvent(new FakeEvent('click', {}));

		expect(lookupCalls[0]).toEqual({
			idref: 'term_delta',
			usage: 'glossary-on-screen',
			lang: undefined,
			options: { stimulusIdentifier: 'passage_1' },
		});
	});
});
