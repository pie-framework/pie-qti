/**
 * Integration tests for Likert Scale Plugin with QTI Player
 */

import '../setup.js';
import { describe, expect, test } from 'bun:test';
import {
	createAssessmentItemDefinition,
	createExtractionRegistry,
	type BaseInteractionData,
} from '@pie-qti/item-player';
import { parse } from 'node-html-parser';
import { likertScalePlugin } from '../../src/index.js';
import type { LikertInteractionData } from '../../src/index.js';

function firstInteraction(itemXml: string, withPlugin = true): BaseInteractionData {
	const definition = createAssessmentItemDefinition({
		itemXml,
		...(withPlugin ? { plugins: [likertScalePlugin] } : {}),
	});
	const session = definition.openSession();
	try {
		const node = session.present().flow.find((entry) => entry.kind === 'interaction');
		if (!node || node.kind !== 'interaction') throw new Error('Expected an interaction');
		return node.mount.interaction;
	} finally {
		session.dispose();
	}
}

describe('Likert Scale Plugin Integration', () => {
	test('definition plugin delivers a typed Likert interaction', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
				identifier="likert-test" title="Test">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE">
						<likertChoice identifier="A">Strongly Disagree</likertChoice>
						<likertChoice identifier="B">Agree</likertChoice>
					</choiceInteraction>
				</itemBody>
			</assessmentItem>`;

		const interaction = firstInteraction(xml) as LikertInteractionData;
		const typedLikertMarker: true = interaction.metadata.isLikert;
		expect(interaction.type).toBe('choiceInteraction');
		expect(interaction.responseId).toBe('RESPONSE');
		expect(typedLikertMarker).toBe(true);
		expect(interaction.metadata.scalePoints).toBe(2);
	});

	test('extraction registry finds and uses Likert extractor', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
				identifier="likert-5pt" title="5-Point Likert">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE">
						<prompt>How confident are you?</prompt>
						<likertChoice identifier="not_at_all">Not At All Confident</likertChoice>
						<likertChoice identifier="slightly">Slightly Confident</likertChoice>
						<likertChoice identifier="moderately">Moderately Confident</likertChoice>
						<likertChoice identifier="very">Very Confident</likertChoice>
						<likertChoice identifier="extremely">Extremely Confident</likertChoice>
					</choiceInteraction>
				</itemBody>
			</assessmentItem>`;

		void xml;
		const registry = createExtractionRegistry({
			version: '2.x',
			toCanonical: (name) => name.toLowerCase(),
			toNative: (name) => name,
			isValidElementName: () => true,
		});
		likertScalePlugin.registerExtractors?.(registry);

		// Parse the choiceInteraction element
		const interactionXml = `<choiceInteraction responseIdentifier="RESPONSE">
			<prompt>How confident are you?</prompt>
			<likertChoice identifier="not_at_all">Not At All Confident</likertChoice>
			<likertChoice identifier="slightly">Slightly Confident</likertChoice>
			<likertChoice identifier="moderately">Moderately Confident</likertChoice>
			<likertChoice identifier="very">Very Confident</likertChoice>
			<likertChoice identifier="extremely">Extremely Confident</likertChoice>
		</choiceInteraction>`;

		const element = parse(interactionXml).firstChild;

		// Create context
		const context = {
			element,
			responseId: 'RESPONSE',
			dom: element,
			declarations: new Map(),
			utils: {
				getChildrenByTag(el: any, tagName: string) {
					return el.childNodes?.filter((n: any) => n.rawTagName === tagName) || [];
				},
				hasChildWithTag(el: any, tagName: string) {
					return el.childNodes?.some((n: any) => n.rawTagName === tagName) || false;
				},
				getHtmlContent(el: any) {
					return el?.innerHTML?.trim() || '';
				},
				getTextContent(el: any) {
					return el?.textContent?.trim() || '';
				},
				getAttribute(el: any, name: string, defaultValue = '') {
					return el.getAttribute(name) || defaultValue;
				},
				getBooleanAttribute(el: any, name: string, defaultValue = false) {
					const value = el.getAttribute(name);
					if (value === null || value === undefined) return defaultValue;
					return value === 'true';
				},
				getNumberAttribute(el: any, name: string, defaultValue: number) {
					const value = el.getAttribute(name);
					return value ? Number(value) : defaultValue;
				},
				getClasses(el: any) {
					const classAttr = el.getAttribute('class');
					return classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
				},
				querySelectorAll(el: any, selector: string) {
					return el.querySelectorAll?.(selector) || [];
				},
				querySelector(el: any, selector: string) {
					return el.querySelector?.(selector) || null;
				},
			},
			config: {},
		};

		// Extract using registry
		const result = registry.extract(element, context as any);

		expect(result.success).toBe(true);
		expect(result.data).toBeDefined();

		if (result.success) {
			const data = result.data as any;
			expect(data.choices).toHaveLength(5);
			expect(data.shuffle).toBe(false);
			expect(data.maxChoices).toBe(1);
			expect(data.metadata.isLikert).toBe(true);
			expect(data.metadata.scalePoints).toBe(5);

			// Check first choice
			expect(data.choices[0].identifier).toBe('not_at_all');
			expect(data.choices[0].text).toBe('Not At All Confident');
			expect(data.choices[0].classes).toContain('likert-choice');
		}
	});

	test('higher-priority Likert extraction wins for authored choiceInteraction', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
				identifier="priority-test" title="Priority Test">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE">
						<likertChoice identifier="A">Disagree</likertChoice>
						<likertChoice identifier="B">Agree</likertChoice>
					</choiceInteraction>
				</itemBody>
			</assessmentItem>`;

		const interaction = firstInteraction(xml) as LikertInteractionData;
		expect(interaction.metadata.isLikert).toBe(true);
		expect(interaction.metadata.scalePoints).toBe(2);
	});

	test('definition works without the plugin using standard extraction', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
				identifier="no-plugin" title="No Plugin">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE">
						<simpleChoice identifier="A">Option A</simpleChoice>
						<simpleChoice identifier="B">Option B</simpleChoice>
					</choiceInteraction>
				</itemBody>
			</assessmentItem>`;

		const interaction = firstInteraction(xml, false);
		expect(interaction.type).toBe('choiceInteraction');
		expect(interaction).not.toHaveProperty('metadata.isLikert');
	});

	test('multiple plugins can be registered', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
				identifier="multi-plugin" title="Multiple Plugins">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE">
						<likertChoice identifier="A">Disagree</likertChoice>
						<likertChoice identifier="B">Agree</likertChoice>
					</choiceInteraction>
				</itemBody>
			</assessmentItem>`;

		const interaction = firstInteraction(xml) as LikertInteractionData;
		expect(interaction.metadata.isLikert).toBe(true);
	});
});
