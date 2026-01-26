/**
 * Tests for standardMatchExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardMatchExtractor } from '../../../src/extraction/extractors/matchExtractor.js';
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
});
