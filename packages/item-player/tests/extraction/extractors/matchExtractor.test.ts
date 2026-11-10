/**
 * Tests for standardMatchExtractor
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../../src/core/Player.js';
import { standardMatchExtractor } from '../../../src/interactions/match/extractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardMatchExtractor', () => {
	test('extracts basic match interaction', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="4">
				<prompt>Match the capitals to their countries</prompt>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="C1" matchMax="1">France</simpleAssociableChoice>
					<simpleAssociableChoice identifier="C2" matchMax="1">Germany</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="A1" matchMax="1">Paris</simpleAssociableChoice>
					<simpleAssociableChoice identifier="A2" matchMax="1">Berlin</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.shuffle).toBe(false);
		expect(result.maxAssociations).toBe(4);
		expect(result.prompt).toBe('Match the capitals to their countries');
	});

	test('extracts source and target sets correctly', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="true" maxAssociations="0">
				<simpleMatchSet>
					<simpleAssociableChoice identifier="S1" matchMax="2">Source 1</simpleAssociableChoice>
					<simpleAssociableChoice identifier="S2" matchMax="1">Source 2</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="T1" matchMax="1">Target 1</simpleAssociableChoice>
					<simpleAssociableChoice identifier="T2" matchMax="3">Target 2</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.sourceSet).toHaveLength(2);
		expect(result.targetSet).toHaveLength(2);
		expect(result.sourceSet[0]).toEqual({ identifier: 'S1', text: 'Source 1', matchMax: 2 });
		expect(result.targetSet[0]).toEqual({ identifier: 'T1', text: 'Target 1', matchMax: 1 });
	});

	test('handles missing match sets gracefully', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.sourceSet).toHaveLength(0);
		expect(result.targetSet).toHaveLength(0);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleMatchSet>
					<simpleAssociableChoice identifier="S1" matchMax="1">Source 1</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="T1" matchMax="1">Target 1</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	test('uses default matchMax when not specified', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleMatchSet>
					<simpleAssociableChoice identifier="S1">Source without matchMax</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="T1">Target without matchMax</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.sourceSet[0].matchMax).toBe(1);
		expect(result.targetSet[0].matchMax).toBe(1);
	});

	test('handles maxAssociations="0" for unlimited associations', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleMatchSet>
					<simpleAssociableChoice identifier="S1" matchMax="1">Source</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="T1" matchMax="1">Target</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.maxAssociations).toBe(0);
	});

	test('delivers no column header: no component renders a tabular match', () => {
		// data-first-column-header (QTI 3.0) presents a tabular match; this player's match
		// is not tabular, so the optional attribute is not delivered under any name.
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" data-first-column-header="Country" maxAssociations="4">
				<simpleMatchSet>
					<simpleAssociableChoice identifier="S1" matchMax="1">Flag</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="T1" matchMax="1">France</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect('firstColumnHeader' in result).toBe(false);
	});

	test('extracts matchMin on source and target choices', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleMatchSet>
					<simpleAssociableChoice identifier="S1" matchMax="2" matchMin="1">Source 1</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="T1" matchMax="2" matchMin="2">Target 1</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.sourceSet[0].matchMin).toBe(1);
		expect(result.targetSet[0].matchMin).toBe(2);
	});

	test('omits matchMin when zero', () => {
		const xml = `
			<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
				<simpleMatchSet>
					<simpleAssociableChoice identifier="S1" matchMax="1">Source 1</simpleAssociableChoice>
				</simpleMatchSet>
				<simpleMatchSet>
					<simpleAssociableChoice identifier="T1" matchMax="1">Target 1</simpleAssociableChoice>
				</simpleMatchSet>
			</matchInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardMatchExtractor.extract(element, context);

		expect(result.sourceSet[0].matchMin).toBeUndefined();
		expect(result.targetSet[0].matchMin).toBeUndefined();
	});

	describe('matchGroup extraction', () => {
		test('extracts single matchGroup value on source and target', () => {
			const xml = `
				<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
					<simpleMatchSet>
						<simpleAssociableChoice identifier="S1" matchMax="1" matchGroup="set-a">Source 1</simpleAssociableChoice>
					</simpleMatchSet>
					<simpleMatchSet>
						<simpleAssociableChoice identifier="T1" matchMax="1" matchGroup="set-b">Target 1</simpleAssociableChoice>
					</simpleMatchSet>
				</matchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMatchExtractor.extract(element, context);

			expect(result.sourceSet[0].matchGroup).toEqual(['set-a']);
			expect(result.targetSet[0].matchGroup).toEqual(['set-b']);
		});

		test('extracts multiple matchGroup values', () => {
			const xml = `
				<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
					<simpleMatchSet>
						<simpleAssociableChoice identifier="S1" matchMax="1" matchGroup="set-a set-b">Source 1</simpleAssociableChoice>
					</simpleMatchSet>
					<simpleMatchSet>
						<simpleAssociableChoice identifier="T1" matchMax="1">Target 1</simpleAssociableChoice>
					</simpleMatchSet>
				</matchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMatchExtractor.extract(element, context);

			expect(result.sourceSet[0].matchGroup).toEqual(['set-a', 'set-b']);
		});

		test('omits matchGroup when absent', () => {
			const xml = `
				<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="0">
					<simpleMatchSet>
						<simpleAssociableChoice identifier="S1" matchMax="1">Source 1</simpleAssociableChoice>
					</simpleMatchSet>
					<simpleMatchSet>
						<simpleAssociableChoice identifier="T1" matchMax="1">Target 1</simpleAssociableChoice>
					</simpleMatchSet>
				</matchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMatchExtractor.extract(element, context);

			expect(result.sourceSet[0].matchGroup).toBeUndefined();
			expect(result.targetSet[0].matchGroup).toBeUndefined();
		});
	});

	describe('canHandle predicate', () => {
		test('handles matchInteraction element', () => {
			const xml = `
				<matchInteraction responseIdentifier="RESPONSE">
					<simpleMatchSet><simpleAssociableChoice identifier="S1">S</simpleAssociableChoice></simpleMatchSet>
					<simpleMatchSet><simpleAssociableChoice identifier="T1">T</simpleAssociableChoice></simpleMatchSet>
				</matchInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardMatchExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-matchInteraction elements', () => {
			const xml = `<associateInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardMatchExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct match data', () => {
			const data = {
				sourceSet: [
					{ identifier: 'S1', text: 'Source 1', matchMax: 1 },
					{ identifier: 'S2', text: 'Source 2', matchMax: 1 },
				],
				targetSet: [
					{ identifier: 'T1', text: 'Target 1', matchMax: 1 },
					{ identifier: 'T2', text: 'Target 2', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardMatchExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty source set', () => {
			const data = {
				sourceSet: [],
				targetSet: [{ identifier: 'T1', text: 'Target 1', matchMax: 1 }],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('matchInteraction must have at least one source choice');
		});

		test('reports error for empty target set', () => {
			const data = {
				sourceSet: [{ identifier: 'S1', text: 'Source 1', matchMax: 1 }],
				targetSet: [],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('matchInteraction must have at least one target choice');
		});

		test('reports error for duplicate source identifiers', () => {
			const data = {
				sourceSet: [
					{ identifier: 'S1', text: 'Source 1', matchMax: 1 },
					{ identifier: 'S1', text: 'Source 2', matchMax: 1 },
				],
				targetSet: [{ identifier: 'T1', text: 'Target 1', matchMax: 1 }],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate source identifier: S1');
		});

		test('reports error for duplicate target identifiers', () => {
			const data = {
				sourceSet: [{ identifier: 'S1', text: 'Source 1', matchMax: 1 }],
				targetSet: [
					{ identifier: 'T1', text: 'Target 1', matchMax: 1 },
					{ identifier: 'T1', text: 'Target 2', matchMax: 1 },
				],
				shuffle: false,
				maxAssociations: 0,
				prompt: null,
			};

			const validation = standardMatchExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate target identifier: T1');
		});
	});

	describe('authored fixed (QTI fixed.SimpleAssociableChoice.Attr)', () => {
		const FIXED_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="m1"
  title="Match fixed" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
  <itemBody>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="true">
      <simpleMatchSet>
        <simpleAssociableChoice identifier="S1" matchMax="1" fixed="true">Source one</simpleAssociableChoice>
        <simpleAssociableChoice identifier="S2" matchMax="1">Source two</simpleAssociableChoice>
        <simpleAssociableChoice identifier="S3" matchMax="1">Source three</simpleAssociableChoice>
        <simpleAssociableChoice identifier="S4" matchMax="1">Source four</simpleAssociableChoice>
        <simpleAssociableChoice identifier="S5" matchMax="1">Source five</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="T1" matchMax="1" fixed="true">Target one</simpleAssociableChoice>
        <simpleAssociableChoice identifier="T2" matchMax="1">Target two</simpleAssociableChoice>
        <simpleAssociableChoice identifier="T3" matchMax="1">Target three</simpleAssociableChoice>
        <simpleAssociableChoice identifier="T4" matchMax="1">Target four</simpleAssociableChoice>
        <simpleAssociableChoice identifier="T5" matchMax="1">Target five</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
  </itemBody>
</assessmentItem>`;

		test('delivers fixed on the choices that author it', () => {
			const element = parseQTI(`
				<matchInteraction responseIdentifier="RESPONSE" shuffle="false">
					<simpleMatchSet>
						<simpleAssociableChoice identifier="S1" matchMax="1" fixed="true">Source one</simpleAssociableChoice>
						<simpleAssociableChoice identifier="S2" matchMax="1">Source two</simpleAssociableChoice>
					</simpleMatchSet>
					<simpleMatchSet>
						<simpleAssociableChoice identifier="T1" matchMax="1">Target one</simpleAssociableChoice>
					</simpleMatchSet>
				</matchInteraction>
			`);
			const result = standardMatchExtractor.extract(element, createTestContext(element, 'RESPONSE'));

			expect(result.sourceSet.find((c) => c.identifier === 'S1')?.fixed).toBe(true);
			expect(result.sourceSet.find((c) => c.identifier === 'S2')?.fixed).toBeUndefined();
			expect(result.targetSet[0].fixed).toBeUndefined();
		});

		test('a fixed choice keeps its authored position in every shuffle session', () => {
			// Sessions differ (each Player gets its own shuffle seed); the fixed
			// first source and target stay first in all of them.
			let moved = 0;
			for (let session = 0; session < 30; session++) {
				const player = new Player({ itemXml: FIXED_ITEM });
				const data = player.getInteractionData()[0] as { sourceSet: Array<{ identifier: string }>; targetSet: Array<{ identifier: string }> };
				if (data.sourceSet[0]?.identifier !== 'S1') moved += 1;
				if (data.targetSet[0]?.identifier !== 'T1') moved += 1;
			}
			expect(moved).toBe(0);
		});
	});
});
