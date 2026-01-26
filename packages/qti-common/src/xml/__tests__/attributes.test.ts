import { describe, expect, it } from 'bun:test';
import { getAttribute, getBooleanAttribute, getNumberAttribute, hasAttribute, toCamelCase, toKebabCase } from '../attributes.js';

describe('toKebabCase', () => {
	it('should convert camelCase to kebab-case', () => {
		expect(toKebabCase('baseType')).toBe('base-type');
		expect(toKebabCase('responseIdentifier')).toBe('response-identifier');
		expect(toKebabCase('maxChoices')).toBe('max-choices');
		expect(toKebabCase('showHide')).toBe('show-hide');
	});

	it('should handle already lowercase names', () => {
		expect(toKebabCase('identifier')).toBe('identifier');
	});

	it('should handle empty string', () => {
		expect(toKebabCase('')).toBe('');
	});
});

describe('toCamelCase', () => {
	it('should convert kebab-case to camelCase', () => {
		expect(toCamelCase('base-type')).toBe('baseType');
		expect(toCamelCase('response-identifier')).toBe('responseIdentifier');
		expect(toCamelCase('max-choices')).toBe('maxChoices');
		expect(toCamelCase('show-hide')).toBe('showHide');
	});

	it('should handle names without hyphens', () => {
		expect(toCamelCase('identifier')).toBe('identifier');
	});

	it('should handle empty string', () => {
		expect(toCamelCase('')).toBe('');
	});
});

describe('getAttribute', () => {
	// Create a mock element for testing
	function createMockElement(attributes: Record<string, string>): Element {
		return {
			getAttribute(name: string) {
				return attributes[name] ?? null;
			},
		} as any;
	}

	describe('QTI 2.x (camelCase attributes)', () => {
		const element = createMockElement({
			identifier: 'RESPONSE',
			baseType: 'float',
			cardinality: 'single',
			responseIdentifier: 'RESPONSE',
			maxChoices: '3',
		});

		it('should get camelCase attributes with camelCase query', () => {
			expect(getAttribute(element, 'baseType')).toBe('float');
			expect(getAttribute(element, 'responseIdentifier')).toBe('RESPONSE');
			expect(getAttribute(element, 'maxChoices')).toBe('3');
		});

		it('should get camelCase attributes with kebab-case query', () => {
			expect(getAttribute(element, 'base-type')).toBe('float');
			expect(getAttribute(element, 'response-identifier')).toBe('RESPONSE');
			expect(getAttribute(element, 'max-choices')).toBe('3');
		});

		it('should get attributes without case conversion', () => {
			expect(getAttribute(element, 'identifier')).toBe('RESPONSE');
			expect(getAttribute(element, 'cardinality')).toBe('single');
		});
	});

	describe('QTI 3.0 (kebab-case attributes)', () => {
		const element = createMockElement({
			identifier: 'RESPONSE',
			'base-type': 'float',
			cardinality: 'single',
			'response-identifier': 'RESPONSE',
			'max-choices': '3',
		});

		it('should get kebab-case attributes with kebab-case query', () => {
			expect(getAttribute(element, 'base-type')).toBe('float');
			expect(getAttribute(element, 'response-identifier')).toBe('RESPONSE');
			expect(getAttribute(element, 'max-choices')).toBe('3');
		});

		it('should get kebab-case attributes with camelCase query', () => {
			expect(getAttribute(element, 'baseType')).toBe('float');
			expect(getAttribute(element, 'responseIdentifier')).toBe('RESPONSE');
			expect(getAttribute(element, 'maxChoices')).toBe('3');
		});

		it('should get attributes without case conversion', () => {
			expect(getAttribute(element, 'identifier')).toBe('RESPONSE');
			expect(getAttribute(element, 'cardinality')).toBe('single');
		});
	});

	describe('missing attributes', () => {
		const element = createMockElement({
			identifier: 'RESPONSE',
		});

		it('should return null for missing attributes', () => {
			expect(getAttribute(element, 'baseType')).toBeNull();
			expect(getAttribute(element, 'base-type')).toBeNull();
			expect(getAttribute(element, 'maxChoices')).toBeNull();
		});
	});
});

describe('hasAttribute', () => {
	function createMockElement(attributes: Record<string, string>): Element {
		return {
			getAttribute(name: string) {
				return attributes[name] ?? null;
			},
		} as any;
	}

	it('should return true for existing attributes', () => {
		const element = createMockElement({ baseType: 'float', 'max-choices': '3' });
		expect(hasAttribute(element, 'baseType')).toBe(true);
		expect(hasAttribute(element, 'base-type')).toBe(true);
		expect(hasAttribute(element, 'maxChoices')).toBe(true);
		expect(hasAttribute(element, 'max-choices')).toBe(true);
	});

	it('should return false for missing attributes', () => {
		const element = createMockElement({ identifier: 'RESPONSE' });
		expect(hasAttribute(element, 'baseType')).toBe(false);
		expect(hasAttribute(element, 'base-type')).toBe(false);
	});
});

describe('getNumberAttribute', () => {
	function createMockElement(attributes: Record<string, string>): Element {
		return {
			getAttribute(name: string) {
				return attributes[name] ?? null;
			},
		} as any;
	}

	it('should parse number attributes', () => {
		const element = createMockElement({ maxChoices: '5', 'min-choices': '1' });
		expect(getNumberAttribute(element, 'maxChoices', 0)).toBe(5);
		expect(getNumberAttribute(element, 'minChoices', 0)).toBe(1);
	});

	it('should return default for missing attributes', () => {
		const element = createMockElement({});
		expect(getNumberAttribute(element, 'maxChoices', 10)).toBe(10);
	});

	it('should return default for invalid numbers', () => {
		const element = createMockElement({ maxChoices: 'abc' });
		expect(getNumberAttribute(element, 'maxChoices', 10)).toBe(10);
	});

	it('should parse float numbers', () => {
		const element = createMockElement({ value: '1.5' });
		expect(getNumberAttribute(element, 'value', 0)).toBe(1.5);
	});
});

describe('getBooleanAttribute', () => {
	function createMockElement(attributes: Record<string, string>): Element {
		return {
			getAttribute(name: string) {
				return attributes[name] ?? null;
			},
		} as any;
	}

	it('should parse true values', () => {
		const element1 = createMockElement({ shuffle: 'true' });
		const element2 = createMockElement({ shuffle: '1' });
		const element3 = createMockElement({ shuffle: 'TRUE' });

		expect(getBooleanAttribute(element1, 'shuffle')).toBe(true);
		expect(getBooleanAttribute(element2, 'shuffle')).toBe(true);
		expect(getBooleanAttribute(element3, 'shuffle')).toBe(true);
	});

	it('should parse false values', () => {
		const element1 = createMockElement({ shuffle: 'false' });
		const element2 = createMockElement({ shuffle: '0' });
		const element3 = createMockElement({ shuffle: 'FALSE' });

		expect(getBooleanAttribute(element1, 'shuffle')).toBe(false);
		expect(getBooleanAttribute(element2, 'shuffle')).toBe(false);
		expect(getBooleanAttribute(element3, 'shuffle')).toBe(false);
	});

	it('should return default for missing attributes', () => {
		const element = createMockElement({});
		expect(getBooleanAttribute(element, 'shuffle', true)).toBe(true);
		expect(getBooleanAttribute(element, 'shuffle', false)).toBe(false);
	});

	it('should return default for invalid values', () => {
		const element = createMockElement({ shuffle: 'yes' });
		expect(getBooleanAttribute(element, 'shuffle', false)).toBe(false);
	});

	it('should work with kebab-case attributes', () => {
		const element = createMockElement({ 'time-dependent': 'true' });
		expect(getBooleanAttribute(element, 'timeDependent')).toBe(true);
		expect(getBooleanAttribute(element, 'time-dependent')).toBe(true);
	});
});
