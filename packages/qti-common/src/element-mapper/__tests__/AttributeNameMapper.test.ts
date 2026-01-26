import { describe, it, expect } from 'vitest';
import { Qti2xAttributeNameMapper } from '../Qti2xAttributeNameMapper';
import { Qti3AttributeNameMapper } from '../Qti3AttributeNameMapper';

describe('Qti2xAttributeNameMapper', () => {
	const mapper = new Qti2xAttributeNameMapper();

	describe('toCanonical', () => {
		it('should return attribute name unchanged (pass-through)', () => {
			expect(mapper.toCanonical('responseIdentifier')).toBe('responseIdentifier');
			expect(mapper.toCanonical('maxChoices')).toBe('maxChoices');
			expect(mapper.toCanonical('shuffle')).toBe('shuffle');
			expect(mapper.toCanonical('baseType')).toBe('baseType');
		});
	});

	describe('toNative', () => {
		it('should return attribute name unchanged (pass-through)', () => {
			expect(mapper.toNative('responseIdentifier')).toBe('responseIdentifier');
			expect(mapper.toNative('maxChoices')).toBe('maxChoices');
			expect(mapper.toNative('shuffle')).toBe('shuffle');
		});
	});

	describe('isValidAttributeName', () => {
		it('should accept camelCase attributes', () => {
			expect(mapper.isValidAttributeName('responseIdentifier')).toBe(true);
			expect(mapper.isValidAttributeName('maxChoices')).toBe(true);
			expect(mapper.isValidAttributeName('baseType')).toBe(true);
		});

		it('should accept simple lowercase attributes', () => {
			expect(mapper.isValidAttributeName('shuffle')).toBe(true);
			expect(mapper.isValidAttributeName('type')).toBe(true);
			expect(mapper.isValidAttributeName('value')).toBe(true);
		});

		it('should reject kebab-case attributes', () => {
			expect(mapper.isValidAttributeName('response-identifier')).toBe(false);
			expect(mapper.isValidAttributeName('max-choices')).toBe(false);
			expect(mapper.isValidAttributeName('base-type')).toBe(false);
		});

		it('should accept standard XML attributes', () => {
			expect(mapper.isValidAttributeName('xml:lang')).toBe(true);
			expect(mapper.isValidAttributeName('xml:base')).toBe(true);
			expect(mapper.isValidAttributeName('xmlns')).toBe(true);
			expect(mapper.isValidAttributeName('xmlns:xsi')).toBe(true);
		});
	});

	describe('version', () => {
		it('should return 2.x', () => {
			expect(mapper.version).toBe('2.x');
		});
	});
});

describe('Qti3AttributeNameMapper', () => {
	const mapper = new Qti3AttributeNameMapper();

	describe('toCanonical', () => {
		it('should convert kebab-case to camelCase for identifiers', () => {
			expect(mapper.toCanonical('response-identifier')).toBe('responseIdentifier');
			expect(mapper.toCanonical('outcome-identifier')).toBe('outcomeIdentifier');
			expect(mapper.toCanonical('template-identifier')).toBe('templateIdentifier');
		});

		it('should convert kebab-case to camelCase for choice attributes', () => {
			expect(mapper.toCanonical('max-choices')).toBe('maxChoices');
			expect(mapper.toCanonical('min-choices')).toBe('minChoices');
		});

		it('should convert kebab-case to camelCase for types', () => {
			expect(mapper.toCanonical('base-type')).toBe('baseType');
		});

		it('should convert kebab-case to camelCase for text interaction attributes', () => {
			expect(mapper.toCanonical('expected-length')).toBe('expectedLength');
			expect(mapper.toCanonical('expected-lines')).toBe('expectedLines');
			expect(mapper.toCanonical('pattern-mask')).toBe('patternMask');
			expect(mapper.toCanonical('placeholder-text')).toBe('placeholderText');
		});

		it('should convert kebab-case to camelCase for slider attributes', () => {
			expect(mapper.toCanonical('lower-bound')).toBe('lowerBound');
			expect(mapper.toCanonical('upper-bound')).toBe('upperBound');
			expect(mapper.toCanonical('step-label')).toBe('stepLabel');
		});

		it('should convert kebab-case to camelCase for match attributes', () => {
			expect(mapper.toCanonical('match-max')).toBe('matchMax');
			expect(mapper.toCanonical('match-min')).toBe('matchMin');
			expect(mapper.toCanonical('max-associations')).toBe('maxAssociations');
			expect(mapper.toCanonical('min-associations')).toBe('minAssociations');
		});

		it('should convert kebab-case to camelCase for hotspot attributes', () => {
			expect(mapper.toCanonical('hotspot-label')).toBe('hotspotLabel');
			expect(mapper.toCanonical('min-hotspots')).toBe('minHotspots');
			expect(mapper.toCanonical('max-hotspots')).toBe('maxHotspots');
		});

		it('should convert kebab-case to camelCase for feedback attributes', () => {
			expect(mapper.toCanonical('show-hide')).toBe('showHide');
			expect(mapper.toCanonical('outcome-value')).toBe('outcomeValue');
		});

		it('should convert kebab-case to camelCase for outcome attributes', () => {
			expect(mapper.toCanonical('normal-maximum')).toBe('normalMaximum');
			expect(mapper.toCanonical('normal-minimum')).toBe('normalMinimum');
			expect(mapper.toCanonical('mastery-value')).toBe('masteryValue');
		});

		it('should convert kebab-case to camelCase for assessment attributes', () => {
			expect(mapper.toCanonical('time-dependent')).toBe('timeDependent');
		});

		it('should handle simple lowercase attributes unchanged', () => {
			expect(mapper.toCanonical('shuffle')).toBe('shuffle');
			expect(mapper.toCanonical('cardinality')).toBe('cardinality');
			expect(mapper.toCanonical('identifier')).toBe('identifier');
		});

		it('should handle unknown kebab-case attributes programmatically', () => {
			expect(mapper.toCanonical('custom-attribute')).toBe('customAttribute');
			expect(mapper.toCanonical('foo-bar-baz')).toBe('fooBarBaz');
		});

		it('should handle already camelCase attributes (edge case)', () => {
			expect(mapper.toCanonical('responseIdentifier')).toBe('responseIdentifier');
			expect(mapper.toCanonical('maxChoices')).toBe('maxChoices');
		});
	});

	describe('toNative', () => {
		it('should convert camelCase to kebab-case for identifiers', () => {
			expect(mapper.toNative('responseIdentifier')).toBe('response-identifier');
			expect(mapper.toNative('outcomeIdentifier')).toBe('outcome-identifier');
			expect(mapper.toNative('templateIdentifier')).toBe('template-identifier');
		});

		it('should convert camelCase to kebab-case for choice attributes', () => {
			expect(mapper.toNative('maxChoices')).toBe('max-choices');
			expect(mapper.toNative('minChoices')).toBe('min-choices');
		});

		it('should convert camelCase to kebab-case for types', () => {
			expect(mapper.toNative('baseType')).toBe('base-type');
		});

		it('should convert camelCase to kebab-case for text interaction attributes', () => {
			expect(mapper.toNative('expectedLength')).toBe('expected-length');
			expect(mapper.toNative('expectedLines')).toBe('expected-lines');
			expect(mapper.toNative('patternMask')).toBe('pattern-mask');
			expect(mapper.toNative('placeholderText')).toBe('placeholder-text');
		});

		it('should handle simple lowercase attributes unchanged', () => {
			expect(mapper.toNative('shuffle')).toBe('shuffle');
			expect(mapper.toNative('cardinality')).toBe('cardinality');
			expect(mapper.toNative('identifier')).toBe('identifier');
		});

		it('should handle unknown camelCase attributes programmatically', () => {
			expect(mapper.toNative('customAttribute')).toBe('custom-attribute');
			expect(mapper.toNative('fooBarBaz')).toBe('foo-bar-baz');
		});

		it('should handle already kebab-case attributes (edge case)', () => {
			expect(mapper.toNative('response-identifier')).toBe('response-identifier');
			expect(mapper.toNative('max-choices')).toBe('max-choices');
		});
	});

	describe('round-trip conversion', () => {
		it('should maintain consistency for camelCase -> kebab -> camelCase', () => {
			const camelCaseAttrs = [
				'responseIdentifier',
				'maxChoices',
				'baseType',
				'expectedLength',
				'lowerBound',
				'matchMax',
				'showHide',
				'normalMaximum',
				'timeDependent',
			];

			for (const attr of camelCaseAttrs) {
				const kebab = mapper.toNative(attr);
				const backToCamel = mapper.toCanonical(kebab);
				expect(backToCamel).toBe(attr);
			}
		});

		it('should maintain consistency for kebab-case -> camelCase -> kebab', () => {
			const kebabCaseAttrs = [
				'response-identifier',
				'max-choices',
				'base-type',
				'expected-length',
				'lower-bound',
				'match-max',
				'show-hide',
				'normal-maximum',
				'time-dependent',
			];

			for (const attr of kebabCaseAttrs) {
				const camel = mapper.toCanonical(attr);
				const backToKebab = mapper.toNative(camel);
				expect(backToKebab).toBe(attr);
			}
		});
	});

	describe('isValidAttributeName', () => {
		it('should accept kebab-case attributes', () => {
			expect(mapper.isValidAttributeName('response-identifier')).toBe(true);
			expect(mapper.isValidAttributeName('max-choices')).toBe(true);
			expect(mapper.isValidAttributeName('base-type')).toBe(true);
		});

		it('should accept simple lowercase attributes', () => {
			expect(mapper.isValidAttributeName('shuffle')).toBe(true);
			expect(mapper.isValidAttributeName('type')).toBe(true);
			expect(mapper.isValidAttributeName('value')).toBe(true);
		});

		it('should reject camelCase attributes', () => {
			expect(mapper.isValidAttributeName('responseIdentifier')).toBe(false);
			expect(mapper.isValidAttributeName('maxChoices')).toBe(false);
			expect(mapper.isValidAttributeName('baseType')).toBe(false);
		});

		it('should accept standard XML attributes', () => {
			expect(mapper.isValidAttributeName('xml:lang')).toBe(true);
			expect(mapper.isValidAttributeName('xml:base')).toBe(true);
			expect(mapper.isValidAttributeName('xmlns')).toBe(true);
			expect(mapper.isValidAttributeName('id')).toBe(true);
		});

		it('should reject uppercase in attribute names', () => {
			expect(mapper.isValidAttributeName('Response-Identifier')).toBe(false);
			expect(mapper.isValidAttributeName('Max-Choices')).toBe(false);
		});
	});

	describe('version', () => {
		it('should return 3.0', () => {
			expect(mapper.version).toBe('3.0');
		});
	});
});
