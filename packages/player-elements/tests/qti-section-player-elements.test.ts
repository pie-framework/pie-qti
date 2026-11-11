import './setup';
import { describe, expect, test } from 'bun:test';
import type { PciModuleResolver, PlayerSecurityConfig } from '@pie-qti/item-player';
import type { QtiSectionFrameworkError, ResolvedQtiSectionComposition } from '@pie-qti/section-player';
import { QTI_SECTION_PLAYER_SPLITPANE_TAG, QTI_SECTION_PLAYER_VERTICAL_TAG } from '../src/constants.js';
import {
	QtiSectionPlayerSplitPaneElement,
	defineQtiSectionPlayerSplitPaneElement,
	type QtiSectionResponseDeltaEvent,
} from '../src/elements/QtiSectionPlayerSplitPaneElement.js';
import {
	QtiSectionPlayerVerticalElement,
	defineQtiSectionPlayerVerticalElement,
} from '../src/elements/QtiSectionPlayerVerticalElement.js';

const ITEM_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1" title="Item 1">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier" />
	<itemBody>
		<p>Prompt</p>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
		</choiceInteraction>
	</itemBody>
</assessmentItem>`;

function createComposition(security?: PlayerSecurityConfig): ResolvedQtiSectionComposition {
	return {
		section: {
			identifier: 'section-1',
			title: 'Section 1',
			role: 'candidate',
			itemRefs: [
				{
					identifier: 'item-1',
					itemXml: ITEM_XML,
					responses: {},
				},
			],
			sharedContext: {
				passages: [
					{
						identifier: 'passage-1',
						kind: 'passage',
						scope: 'section',
						rawHtml: '<h3>Reading Passage</h3>',
					},
				],
				stimuli: [],
				rubricBlocks: [],
				testFeedback: [],
				stylesheets: [],
				catalogSources: [],
				assetDiagnostics: [],
			},
		},
		activeItem: {
			identifier: 'item-1',
			itemXml: ITEM_XML,
			responses: {},
		},
		activeItemIndex: 0,
		sharedContext: {
			passages: [
				{
					identifier: 'passage-1',
					kind: 'passage',
					scope: 'section',
					rawHtml: '<h3>Reading Passage</h3>',
				},
			],
			stimuli: [],
			rubricBlocks: [],
			testFeedback: [],
			stylesheets: [],
			catalogSources: [],
			assetDiagnostics: [],
		},
		layout: 'split-pane',
		canPrevious: false,
		canNext: false,
		snapshot: {
			sectionIdentifier: 'section-1',
			activeItemIdentifier: 'item-1',
			activeItemIndex: 0,
			itemCount: 1,
			responses: { 'item-1': {} },
		},
		diagnostics: [],
		security,
	};
}

class TestSplitPaneElement extends QtiSectionPlayerSplitPaneElement {
	exposeProps() {
		return this.getProps();
	}
}

describe('section player custom elements', () => {
	test('registers split-pane and vertical tags idempotently', () => {
		defineQtiSectionPlayerSplitPaneElement();
		defineQtiSectionPlayerSplitPaneElement();
		defineQtiSectionPlayerVerticalElement();
		defineQtiSectionPlayerVerticalElement();

		expect(customElements.get(QTI_SECTION_PLAYER_SPLITPANE_TAG)).toBe(QtiSectionPlayerSplitPaneElement);
		expect(customElements.get(QTI_SECTION_PLAYER_VERTICAL_TAG)).toBe(QtiSectionPlayerVerticalElement);
	});

	test('connecting before assigning composition does not throw', () => {
		const element = new QtiSectionPlayerVerticalElement();

		expect(() => element.connectedCallback()).not.toThrow();
	});

	test('routes response changes with section, item, response identifiers, and value', () => {
		if (!customElements.get('test-qti-section-player-splitpane')) {
			customElements.define('test-qti-section-player-splitpane', TestSplitPaneElement);
		}
		const security: PlayerSecurityConfig = { allowIframes: false };
		const moduleResolver: PciModuleResolver = () => ({});
		const element = document.createElement('test-qti-section-player-splitpane') as TestSplitPaneElement;
		const events: QtiSectionResponseDeltaEvent[] = [];
		const eventOptions: Array<Pick<CustomEventInit<QtiSectionResponseDeltaEvent>, 'bubbles' | 'composed'>> = [];
		element.addEventListener('qti-section-response-delta', (event) => {
			const customEvent = event as CustomEvent<QtiSectionResponseDeltaEvent>;
			events.push(customEvent.detail);
		});

		element.composition = createComposition(security);
		element.security = undefined;
		element.pci = { baseUrl: 'https://packages.example/items/', moduleResolver };
		const props = element.exposeProps();
		const OriginalCustomEvent = globalThis.CustomEvent;
		globalThis.CustomEvent = class extends OriginalCustomEvent {
			constructor(type: string, init?: CustomEventInit<QtiSectionResponseDeltaEvent>) {
				eventOptions.push({ bubbles: init?.bubbles, composed: init?.composed });
				super(type, init);
			}
		} as typeof CustomEvent;
		try {
			props.onResponseChange('item-1', 'RESPONSE', ['A']);
		} finally {
			globalThis.CustomEvent = OriginalCustomEvent;
		}

		expect(props.security).toBe(security);
		expect(props.pci).toEqual({ baseUrl: 'https://packages.example/items/', moduleResolver });
		expect(events).toEqual([
			{
				sectionIdentifier: 'section-1',
				itemIdentifier: 'item-1',
				responseIdentifier: 'RESPONSE',
				value: ['A'],
			},
		]);
		expect(eventOptions).toEqual([{ bubbles: true, composed: true }]);
	});

	test('heading-level reaches the layout as headingLevel and reflects the property', () => {
		if (!customElements.get('test-qti-section-player-splitpane')) {
			customElements.define('test-qti-section-player-splitpane', TestSplitPaneElement);
		}
		const element = document.createElement('test-qti-section-player-splitpane') as TestSplitPaneElement;
		element.composition = createComposition();
		expect(element.exposeProps().headingLevel).toBeUndefined();

		element.attributeChangedCallback('heading-level', null, '2');
		expect(element.headingLevel).toBe(2);
		expect(element.exposeProps().headingLevel).toBe(2);

		element.attributeChangedCallback('heading-level', '2', 'seven');
		expect(element.headingLevel).toBeUndefined();
		expect('headingLevel' in element.exposeProps()).toBe(false);

		element.headingLevel = 4;
		expect(element.getAttribute('heading-level')).toBe('4');
		element.headingLevel = undefined;
		expect(element.hasAttribute('heading-level')).toBe(false);
	});

	test('display-settings reaches the layout as displaySettings and reflects the property', () => {
		if (!customElements.get('test-qti-section-player-splitpane')) {
			customElements.define('test-qti-section-player-splitpane', TestSplitPaneElement);
		}
		expect(QtiSectionPlayerSplitPaneElement.observedAttributes).toContain('display-settings');
		const element = document.createElement('test-qti-section-player-splitpane') as TestSplitPaneElement;
		element.composition = createComposition();
		// Unset, the layout's own default (on) applies.
		expect(element.displaySettings).toBe(true);
		expect('displaySettings' in element.exposeProps()).toBe(false);

		element.attributeChangedCallback('display-settings', null, 'false');
		expect(element.displaySettings).toBe(false);
		expect(element.exposeProps().displaySettings).toBe(false);

		element.attributeChangedCallback('display-settings', 'false', 'true');
		expect(element.displaySettings).toBe(true);
		expect(element.exposeProps().displaySettings).toBe(true);

		element.displaySettings = false;
		expect(element.getAttribute('display-settings')).toBe('false');
		element.displaySettings = true;
		expect(element.hasAttribute('display-settings')).toBe(false);
	});

	test('framework errors, display settings changes and the item pane reach the host as typed events', () => {
		if (!customElements.get('test-qti-section-player-splitpane')) {
			customElements.define('test-qti-section-player-splitpane', TestSplitPaneElement);
		}
		const element = document.createElement('test-qti-section-player-splitpane') as TestSplitPaneElement;
		element.composition = createComposition();
		const received: Array<{ type: string; detail: unknown }> = [];
		for (const type of ['qti-section-framework-error', 'qti-section-display-settings', 'qti-section-item-pane-ready'] as const) {
			element.addEventListener(type, (event) => {
				received.push({ type, detail: (event as CustomEvent).detail });
			});
		}
		const eventOptions: Array<Pick<CustomEventInit, 'bubbles' | 'composed'>> = [];
		const OriginalCustomEvent = globalThis.CustomEvent;
		globalThis.CustomEvent = class extends OriginalCustomEvent {
			constructor(type: string, init?: CustomEventInit) {
				eventOptions.push({ bubbles: init?.bubbles, composed: init?.composed });
				super(type, init);
			}
		} as typeof CustomEvent;

		const props = element.exposeProps();
		const error = { code: 'item-player-load-failed', message: 'chunk failed', itemIdentifier: 'item-1' };
		const settingsEvent = { sectionIdentifier: 'section-1', settings: { textSize: 2 as const }, pnp: { display: {} } };
		const pane = document.createElement('div');
		try {
			props.onFrameworkError?.(error);
			props.onDisplaySettingsChange?.(settingsEvent);
			props.onItemPaneReady?.(pane);
		} finally {
			globalThis.CustomEvent = OriginalCustomEvent;
		}

		expect(received).toEqual([
			{ type: 'qti-section-framework-error', detail: error },
			{ type: 'qti-section-display-settings', detail: settingsEvent },
			{ type: 'qti-section-item-pane-ready', detail: { element: pane } },
		]);
		expect(eventOptions).toEqual([
			{ bubbles: true, composed: true },
			{ bubbles: true, composed: true },
			{ bubbles: true, composed: true },
		]);
	});

	test('a composition the layouts cannot render emits a framework error instead of throwing', () => {
		if (!customElements.get('test-qti-section-player-splitpane')) {
			customElements.define('test-qti-section-player-splitpane', TestSplitPaneElement);
		}
		const element = document.createElement('test-qti-section-player-splitpane') as TestSplitPaneElement;
		const errors: QtiSectionFrameworkError[] = [];
		element.addEventListener('qti-section-framework-error', (event) => {
			errors.push((event as CustomEvent<QtiSectionFrameworkError>).detail);
		});

		// A hand-built composition without its shared context.
		element.composition = { ...createComposition(), sharedContext: undefined } as unknown as ResolvedQtiSectionComposition;
		expect(() => element.connectedCallback()).not.toThrow();
		expect(errors).toEqual([
			{
				sectionIdentifier: 'section-1',
				code: 'invalid-composition',
				message: 'The composition has no shared context.',
			},
		]);

		// The same problem is announced once, not on every update.
		expect(() => element.connectedCallback()).not.toThrow();
		expect(errors).toHaveLength(1);

		// A different problem is a new report.
		element.composition = { ...createComposition(), snapshot: undefined } as unknown as ResolvedQtiSectionComposition;
		expect(() => element.connectedCallback()).not.toThrow();
		expect(errors).toHaveLength(2);
		expect(errors[1]).toMatchObject({ code: 'invalid-composition', message: 'The composition has no response snapshot.' });
	});

	test('focusActiveItem without a mounted layout resolves false', async () => {
		const element = new QtiSectionPlayerVerticalElement();
		expect(await element.focusActiveItem()).toBe(false);
	});
});
