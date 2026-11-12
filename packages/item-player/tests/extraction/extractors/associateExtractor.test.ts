/**
 * Tests for standardAssociateExtractor
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../../src/core/Player.js';
import { standardAssociateExtractor } from '../../../src/interactions/associate/extractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

const FIXED_ASSOCIATE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a1"
  title="Associate fixed" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"/>
  <itemBody>
    <associateInteraction responseIdentifier="RESPONSE" shuffle="true">
      <simpleAssociableChoice identifier="A" matchMax="1" fixed="true">Alpha</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="1">Bravo</simpleAssociableChoice>
      <simpleAssociableChoice identifier="C" matchMax="1">Charlie</simpleAssociableChoice>
      <simpleAssociableChoice identifier="D" matchMax="1">Delta</simpleAssociableChoice>
      <simpleAssociableChoice identifier="E" matchMax="1">Echo</simpleAssociableChoice>
    </associateInteraction>
  </itemBody>
</assessmentItem>`;

describe('standardAssociateExtractor authored fixed (QTI fixed.SimpleAssociableChoice.Attr)', () => {
	test('delivers fixed on the choices that author it', () => {
		const element = parseQTI(`
			<associateInteraction responseIdentifier="RESPONSE" shuffle="false">
				<simpleAssociableChoice identifier="A" matchMax="1" fixed="true">Alpha</simpleAssociableChoice>
				<simpleAssociableChoice identifier="B" matchMax="1">Bravo</simpleAssociableChoice>
			</associateInteraction>
		`);
		const result = standardAssociateExtractor.extract(element, createTestContext(element, 'RESPONSE'));

		expect(result.choices.find((c) => c.identifier === 'A')?.fixed).toBe(true);
		expect(result.choices.find((c) => c.identifier === 'B')?.fixed).toBeUndefined();
	});

	test('a fixed choice keeps its authored position in every shuffle session', () => {
		// Sessions differ (each Player gets its own shuffle seed); the fixed
		// first choice stays first in all of them.
		let moved = 0;
		for (let session = 0; session < 30; session++) {
			const player = new Player({ itemXml: FIXED_ASSOCIATE_ITEM });
			const data = player.getInteractionData()[0] as unknown as { choices: Array<{ identifier: string }> };
			if (data.choices[0]?.identifier !== 'A') moved += 1;
		}
		expect(moved).toBe(0);
	});
});

describe('standardAssociateExtractor', () => {
	test('extracts basic associate interaction', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="true" maxAssociations="3">
				<prompt>Associate related items</prompt>
				<simpleAssociableChoice identifier="A" matchMax="2">Item A</simpleAssociableChoice>
				<simpleAssociableChoice identifier="B" matchMax="2">Item B</simpleAssociableChoice>
				<simpleAssociableChoice identifier="C" matchMax="2">Item C</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.shuffle).toBe(true);
		expect(result.maxAssociations).toBe(3);
		expect(result.prompt).toBe('Associate related items');
		expect(result.choices).toHaveLength(3);
	});

	test('extracts choices with matchMax values', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleAssociableChoice identifier="A" matchMax="1">Single match</simpleAssociableChoice>
				<simpleAssociableChoice identifier="B" matchMax="3">Multiple matches</simpleAssociableChoice>
				<simpleAssociableChoice identifier="C" matchMax="0">Unlimited</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.choices[0].matchMax).toBe(1);
		expect(result.choices[1].matchMax).toBe(3);
		expect(result.choices[2].matchMax).toBe(0);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleAssociableChoice identifier="A" matchMax="1">Item A</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	test('uses default values when attributes not specified', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE">
				<simpleAssociableChoice identifier="A">Item A</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		// maxAssociations is optional with default 1 in QTI 2.1 (XSD), 2.2 (Table 5.6.2)
		// and 3.0 (Table 5.8.2); 0 means no restriction.
		expect(result.maxAssociations).toBe(1);
		expect(result.choices[0].matchMax).toBe(1);
	});

	test('authored maxAssociations=0 stays 0 (no restriction)', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" maxAssociations="0">
				<simpleAssociableChoice identifier="A">Item A</simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.maxAssociations).toBe(0);
	});

	test('handles choices with HTML content', () => {
		const xml = `
			<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleAssociableChoice identifier="A" matchMax="1">Item with <strong>bold</strong></simpleAssociableChoice>
				<simpleAssociableChoice identifier="B" matchMax="1">Item with <em>italic</em></simpleAssociableChoice>
			</associateInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardAssociateExtractor.extract(element, context);

		expect(result.choices[0].text).toContain('bold');
		expect(result.choices[1].text).toContain('italic');
	});

	describe('canHandle predicate', () => {
		test('handles associateInteraction element', () => {
			const xml = `
				<associateInteraction responseIdentifier="RESPONSE">
					<simpleAssociableChoice identifier="A">Item A</simpleAssociableChoice>
				</associateInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardAssociateExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-associateInteraction elements', () => {
			const xml = `<matchInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardAssociateExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('matchGroup extraction', () => {
		test('extracts single matchGroup value', () => {
			const xml = `
				<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
					<simpleAssociableChoice identifier="A" matchMax="1" matchGroup="animal">Cat</simpleAssociableChoice>
					<simpleAssociableChoice identifier="B" matchMax="1" matchGroup="animal">Dog</simpleAssociableChoice>
					<simpleAssociableChoice identifier="C" matchMax="1">Other</simpleAssociableChoice>
				</associateInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardAssociateExtractor.extract(element, context);

			expect(result.choices[0].matchGroup).toEqual(['animal']);
			expect(result.choices[1].matchGroup).toEqual(['animal']);
		});

		test('extracts multiple matchGroup values', () => {
			const xml = `
				<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
					<simpleAssociableChoice identifier="A" matchMax="1" matchGroup="set-a set-b">Item A</simpleAssociableChoice>
					<simpleAssociableChoice identifier="B" matchMax="1">Item B</simpleAssociableChoice>
				</associateInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardAssociateExtractor.extract(element, context);

			expect(result.choices[0].matchGroup).toEqual(['set-a', 'set-b']);
		});

		test('omits matchGroup when absent', () => {
			const xml = `
				<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
					<simpleAssociableChoice identifier="A" matchMax="1">Item A</simpleAssociableChoice>
				</associateInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardAssociateExtractor.extract(element, context);

			expect(result.choices[0].matchGroup).toBeUndefined();
		});
	});

	describe('validation', () => {
		test('validates correct associate data', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A', matchMax: 1 },
					{ identifier: 'B', text: 'Item B', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for insufficient choices', () => {
			const data = {
				choices: [{ identifier: 'A', text: 'Item A', matchMax: 1 }],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('associateInteraction must have at least 2 choices');
		});

		test('reports error for missing identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A', matchMax: 1 },
					{ identifier: '', text: 'Item B', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('All choices must have an identifier');
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				choices: [
					{ identifier: 'A', text: 'Item A', matchMax: 1 },
					{ identifier: 'A', text: 'Item B', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardAssociateExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate choice identifier: A');
		});
	});
});
