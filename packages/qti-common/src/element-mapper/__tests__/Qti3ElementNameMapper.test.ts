import { describe, expect, it } from 'bun:test';
import { Qti3ElementNameMapper } from '../Qti3ElementNameMapper.js';

describe('Qti3ElementNameMapper', () => {
	const mapper = new Qti3ElementNameMapper();

	describe('version', () => {
		it('should return correct version', () => {
			expect(mapper.version).toBe('3.0');
		});
	});

	describe('toCanonical', () => {
		it('should convert qti- prefixed kebab-case to canonical', () => {
			expect(mapper.toCanonical('qti-choice-interaction')).toBe('choiceinteraction');
			expect(mapper.toCanonical('qti-response-declaration')).toBe('responsedeclaration');
			expect(mapper.toCanonical('qti-simple-choice')).toBe('simplechoice');
		});

		it('should handle assessment-specific elements', () => {
			expect(mapper.toCanonical('qti-assessment-item')).toBe('assessmentitem');
			expect(mapper.toCanonical('qti-assessment-test')).toBe('assessmenttest');
		});

		it('should handle processing elements', () => {
			expect(mapper.toCanonical('qti-response-processing')).toBe('responseprocessing');
			expect(mapper.toCanonical('qti-template-processing')).toBe('templateprocessing');
			expect(mapper.toCanonical('qti-outcome-processing')).toBe('outcomeprocessing');
		});

		it('should normalize internal QTI 2.x-style names', () => {
			expect(mapper.toCanonical('choiceInteraction')).toBe('choiceinteraction');
			expect(mapper.toCanonical('positionObjectStage')).toBe('positionobjectstage');
		});

		it('should handle empty string', () => {
			expect(mapper.toCanonical('')).toBe('');
		});

		it('should preserve non-QTI vocabulary names', () => {
			expect(mapper.toCanonical('object')).toBe('object');
			expect(mapper.toCanonical('annotation-xml')).toBe('annotation-xml');
			expect(mapper.toCanonical('linearGradient')).toBe('linearGradient');
		});
	});

	describe('toNative', () => {
		it('should convert canonical to qti- prefixed kebab-case', () => {
			expect(mapper.toNative('choiceinteraction')).toBe('qti-choice-interaction');
			expect(mapper.toNative('responsedeclaration')).toBe('qti-response-declaration');
			expect(mapper.toNative('simplechoice')).toBe('qti-simple-choice');
		});

		it('should handle assessment elements', () => {
			expect(mapper.toNative('assessmentitem')).toBe('qti-assessment-item');
			expect(mapper.toNative('assessmenttest')).toBe('qti-assessment-test');
		});

		it('should handle processing elements', () => {
			expect(mapper.toNative('responseprocessing')).toBe('qti-response-processing');
			expect(mapper.toNative('templateprocessing')).toBe('qti-template-processing');
			expect(mapper.toNative('outcomeprocessing')).toBe('qti-outcome-processing');
		});

		it('should handle interaction elements', () => {
			expect(mapper.toNative('matchinteraction')).toBe('qti-match-interaction');
			expect(mapper.toNative('textentryinteraction')).toBe('qti-text-entry-interaction');
			expect(mapper.toNative('extendedtextinteraction')).toBe('qti-extended-text-interaction');
			expect(mapper.toNative('hotspotinteraction')).toBe('qti-hotspot-interaction');
		});

		it('should handle body elements', () => {
			expect(mapper.toNative('itembody')).toBe('qti-item-body');
		});

		it('should preserve HTML, MathML, SVG, and extension vocabulary names', () => {
			for (const name of ['object', 'param', 'audio', 'video', 'source', 'math', 'linearGradient', 'vendor-widget']) {
				expect(mapper.toNative(name)).toBe(name);
			}
		});

		it('should map positionObjectStage as QTI vocabulary', () => {
			expect(mapper.toNative('positionobjectstage')).toBe('qti-position-object-stage');
		});

		it('should handle empty string', () => {
			expect(mapper.toNative('')).toBe('');
		});
	});

	describe('isValidElementName', () => {
		it('should accept valid qti- prefixed kebab-case names', () => {
			expect(mapper.isValidElementName('qti-choice-interaction')).toBe(true);
			expect(mapper.isValidElementName('qti-response-declaration')).toBe(true);
			expect(mapper.isValidElementName('qti-simple-choice')).toBe(true);
		});

		it('should reject names without qti- prefix', () => {
			expect(mapper.isValidElementName('choice-interaction')).toBe(false);
		});

		it('should reject names with uppercase', () => {
			expect(mapper.isValidElementName('qti-Choice-Interaction')).toBe(false);
		});

		it('should reject names starting with numbers after prefix', () => {
			expect(mapper.isValidElementName('qti-1choice')).toBe(false);
		});

		it('should reject empty string', () => {
			expect(mapper.isValidElementName('')).toBe(false);
		});

		it('should reject just the prefix', () => {
			expect(mapper.isValidElementName('qti-')).toBe(false);
		});

		it('should reject names with double hyphens', () => {
			expect(mapper.isValidElementName('qti-choice--interaction')).toBe(false);
		});

		it('should reject names ending with hyphen', () => {
			expect(mapper.isValidElementName('qti-choice-')).toBe(false);
		});
	});

	describe('round-trip conversion', () => {
		const testCases = [
			'choiceinteraction',
			'responsedeclaration',
			'outcomedeclaration',
			'templatedeclaration',
			'matchinteraction',
			'textentryinteraction',
			'extendedtextinteraction',
			'hotspotinteraction',
			'itembody',
			'responseprocessing',
			'templateprocessing',
			'assessmentitem',
			'assessmenttest',
		];

		testCases.forEach((canonical) => {
			it(`should maintain ${canonical} through round-trip`, () => {
				const native = mapper.toNative(canonical);
				const canonical2 = mapper.toCanonical(native);
				expect(canonical).toBe(canonical2);
			});
		});
	});

	describe('QTI 2.x to QTI 3.0 equivalence', () => {
		it('should produce same canonical form as QTI 2.x', () => {
			// These should all map to the same canonical form
			expect(mapper.toCanonical('qti-choice-interaction')).toBe('choiceinteraction');
			expect(mapper.toCanonical('qti-response-declaration')).toBe('responsedeclaration');
			expect(mapper.toCanonical('qti-item-body')).toBe('itembody');
		});
	});
});
