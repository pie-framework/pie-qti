import { describe, expect, it } from 'bun:test';
import { Qti2xElementNameMapper } from '../Qti2xElementNameMapper.js';

describe('Qti2xElementNameMapper', () => {
	const mapper = new Qti2xElementNameMapper();

	describe('version', () => {
		it('should return correct version', () => {
			expect(mapper.version).toBe('2.x');
		});
	});

	describe('toCanonical', () => {
		it('should convert camelCase to lowercase', () => {
			expect(mapper.toCanonical('choiceInteraction')).toBe('choiceinteraction');
			expect(mapper.toCanonical('responseDeclaration')).toBe('responsedeclaration');
			expect(mapper.toCanonical('simpleChoice')).toBe('simplechoice');
		});

		it('should handle lowercase input', () => {
			expect(mapper.toCanonical('assessmentitem')).toBe('assessmentitem');
		});

		it('should handle uppercase input', () => {
			expect(mapper.toCanonical('CHOICEINTERACTION')).toBe('choiceinteraction');
		});

		it('should handle empty string', () => {
			expect(mapper.toCanonical('')).toBe('');
		});
	});

	describe('toNative', () => {
		it('should return canonical name as-is', () => {
			expect(mapper.toNative('choiceinteraction')).toBe('choiceinteraction');
			expect(mapper.toNative('responsedeclaration')).toBe('responsedeclaration');
		});

		it('should handle empty string', () => {
			expect(mapper.toNative('')).toBe('');
		});
	});

	describe('isValidElementName', () => {
		it('should accept valid camelCase names', () => {
			expect(mapper.isValidElementName('choiceInteraction')).toBe(true);
			expect(mapper.isValidElementName('responseDeclaration')).toBe(true);
			expect(mapper.isValidElementName('simpleChoice')).toBe(true);
		});

		it('should accept lowercase names', () => {
			expect(mapper.isValidElementName('choiceinteraction')).toBe(true);
		});

		it('should reject names with hyphens', () => {
			expect(mapper.isValidElementName('choice-interaction')).toBe(false);
		});

		it('should reject names starting with numbers', () => {
			expect(mapper.isValidElementName('1choice')).toBe(false);
		});

		it('should reject empty string', () => {
			expect(mapper.isValidElementName('')).toBe(false);
		});
	});

	describe('round-trip conversion', () => {
		const testCases = [
			'choiceInteraction',
			'responseDeclaration',
			'outcomeDeclaration',
			'templateDeclaration',
			'matchInteraction',
			'textEntryInteraction',
			'extendedTextInteraction',
			'hotspotInteraction',
			'itemBody',
			'responseProcessing',
			'templateProcessing',
		];

		testCases.forEach((name) => {
			it(`should maintain ${name} through round-trip`, () => {
				const canonical = mapper.toCanonical(name);
				const native = mapper.toNative(canonical);
				const canonical2 = mapper.toCanonical(native);
				expect(canonical).toBe(canonical2);
			});
		});
	});
});
