/**
 * Integration tests for Likert Scale Plugin with QTI Player
 */

import '../setup.js';
import { describe, expect, test } from 'bun:test';
import { Player } from '@pie-qti/qti2-item-player';
import { parse } from 'node-html-parser';
import { likertScalePlugin } from '../../src/index.js';

describe('Likert Scale Plugin Integration', () => {
	test('plugin registers successfully with Player', () => {
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

		const player = new Player({
			itemXml: xml,
			plugins: [likertScalePlugin],
		});

		// Verify extractor was registered
		const registry = player.getExtractionRegistry();
		expect(registry.hasExtractor('acme:likert-choice')).toBe(true);

		// Verify extractor has correct priority
		const extractors = registry.getExtractorsForType('choiceInteraction');
		const likertExtractor = extractors.find((e) => e.id === 'acme:likert-choice');
		expect(likertExtractor).toBeDefined();
		expect(likertExtractor!.priority).toBe(500);
	});

	test('extraction registry finds and uses Likert extractor', () => {
		// Create player with plugin
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

		const player = new Player({
			itemXml: xml,
			plugins: [likertScalePlugin],
		});

		const registry = player.getExtractionRegistry();

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

	test('extractor priority ensures Likert takes precedence over standard', () => {
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

		const player = new Player({
			itemXml: xml,
			plugins: [likertScalePlugin],
		});

		const registry = player.getExtractionRegistry();
		const extractors = registry.getExtractorsForType('choiceInteraction');

		// Find both extractors
		const likertExtractor = extractors.find((e) => e.id === 'acme:likert-choice');
		const standardExtractor = extractors.find((e) => e.id === 'qti:choice-interaction');

		expect(likertExtractor).toBeDefined();
		expect(standardExtractor).toBeDefined();

		// Likert should have higher priority (500 vs 10)
		expect(likertExtractor!.priority).toBe(500);
		expect(standardExtractor!.priority).toBe(10);
		expect(likertExtractor!.priority).toBeGreaterThan(standardExtractor!.priority);
	});

	test('player works without plugin (standard extractors only)', () => {
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

		const player = new Player({
			itemXml: xml,
			// No plugins
		});

		const registry = player.getExtractionRegistry();
		expect(registry.hasExtractor('acme:likert-choice')).toBe(false);
		expect(registry.hasExtractor('qti:choice-interaction')).toBe(true);
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

		const player = new Player({
			itemXml: xml,
			plugins: [likertScalePlugin], // Could add more plugins here
		});

		const registry = player.getExtractionRegistry();

		// All extractors should be registered
		expect(registry.hasExtractor('acme:likert-choice')).toBe(true);
		expect(registry.hasExtractor('qti:choice-interaction')).toBe(true);
		expect(registry.hasExtractor('qti:text-entry-interaction')).toBe(true);
	});
});
