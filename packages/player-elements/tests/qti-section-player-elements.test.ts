import './setup';
import { describe, expect, test } from 'bun:test';
import type { PlayerSecurityConfig } from '@pie-qti/item-player';
import type { ResolvedQtiSectionComposition } from '@pie-qti/section-player';
import { QTI_SECTION_PLAYER_SPLITPANE_TAG, QTI_SECTION_PLAYER_VERTICAL_TAG } from '../src/constants.js';
import {
	QtiSectionPlayerSplitPaneElement,
	defineQtiSectionPlayerSplitPaneElement,
	type QtiSectionResponseDeltaDetail,
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
		const element = document.createElement('test-qti-section-player-splitpane') as TestSplitPaneElement;
		const events: QtiSectionResponseDeltaDetail[] = [];
		element.addEventListener('qti-section-response-delta', (event) => {
			events.push((event as CustomEvent<QtiSectionResponseDeltaDetail>).detail);
		});

		element.composition = createComposition(security);
		element.security = undefined;
		const props = element.exposeProps();
		props.onResponseChange('item-1', 'RESPONSE', ['A']);

		expect(props.security).toBe(security);
		expect(events).toEqual([
			{
				sectionIdentifier: 'section-1',
				itemIdentifier: 'item-1',
				responseIdentifier: 'RESPONSE',
				value: ['A'],
			},
		]);
	});
});
