import { describe, expect, test } from 'bun:test';
import {
	Qti3AttributeNameMapper,
	Qti3ElementNameMapper,
} from '@pie-qti/qti-common';
import { standardExtendedTextExtractor } from '../../../src/interactions/extended-text/extractor.js';
import type { VariableDeclaration } from '../../../src/extraction/types.js';
import { createTestContext, parseQTI } from '../test-utils.js';

function declarations(declaration: VariableDeclaration): Map<string, VariableDeclaration> {
	return new Map([[declaration.identifier, declaration]]);
}

describe('standardExtendedTextExtractor', () => {
	test('extracts QTI 2.2 single-response attributes and declaration semantics', () => {
		const element = parseQTI(`
			<extendedTextInteraction
				responseIdentifier="RESPONSE"
				base="16"
				stringIdentifier="RAW"
				minStrings="1"
				maxStrings="1"
				expectedLines="5"
				expectedLength="500"
				placeholderText="Type your essay"
				format="preformatted"
			/>
		`);
		const context = createTestContext(
			element,
			'RESPONSE',
			element,
			declarations({ identifier: 'RESPONSE', cardinality: 'single', baseType: 'integer' }),
		);

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result).toMatchObject({
			cardinality: 'single',
			baseType: 'integer',
			base: 16,
			stringIdentifier: 'RAW',
			minStrings: 1,
			maxStrings: 1,
			expectedLines: 5,
			expectedLength: 500,
			placeholderText: 'Type your essay',
			format: 'preformatted',
		});
	});

	test('extracts QTI 3.0 kebab-case container attributes', () => {
		const element = parseQTI(`
			<qti-extended-text-interaction
				response-identifier="RESPONSE"
				string-identifier="RAW"
				min-strings="2"
				max-strings="4"
				expected-lines="6"
				expected-length="120"
				placeholder-text="Part"
			/>
		`);
		const context = createTestContext(
			element,
			'RESPONSE',
			element,
			declarations({ identifier: 'RESPONSE', cardinality: 'ordered', baseType: 'string' }),
			{
				elementNameMapper: new Qti3ElementNameMapper(),
				attributeNameMapper: new Qti3AttributeNameMapper(),
			} as any,
		);

		const result = standardExtendedTextExtractor.extract(element, context);

		expect(result).toMatchObject({
			cardinality: 'ordered',
			baseType: 'string',
			stringIdentifier: 'RAW',
			minStrings: 2,
			maxStrings: 4,
			expectedLines: 6,
			expectedLength: 120,
			placeholderText: 'Part',
		});
	});

	test('uses QTI defaults and record declaration shape', () => {
		const element = parseQTI('<extendedTextInteraction responseIdentifier="RESPONSE"/>');
		const context = createTestContext(
			element,
			'RESPONSE',
			element,
			declarations({ identifier: 'RESPONSE', cardinality: 'record' }),
		);

		expect(standardExtendedTextExtractor.extract(element, context)).toMatchObject({
			cardinality: 'record',
			baseType: undefined,
			base: 10,
			minStrings: 0,
			maxStrings: 1,
			expectedLines: 3,
			expectedLength: 200,
			format: 'plain',
		});
	});

	test('recognizes QTI 2.x and QTI 3.0 element names', () => {
		const qti2 = parseQTI('<extendedTextInteraction responseIdentifier="RESPONSE"/>');
		const qti3 = parseQTI('<qti-extended-text-interaction response-identifier="RESPONSE"/>');

		expect(standardExtendedTextExtractor.canHandle(qti2, createTestContext(qti2))).toBe(true);
		expect(standardExtendedTextExtractor.canHandle(qti3, createTestContext(qti3))).toBe(true);
	});

	test('validates declaration, base, and string-count constraints', () => {
		const valid = {
			cardinality: 'multiple' as const,
			baseType: 'string',
			base: 10,
			minStrings: 1,
			maxStrings: 3,
			expectedLines: 0,
			expectedLength: 0,
			format: 'plain',
			placeholderText: '',
			prompt: null,
		};
		expect(standardExtendedTextExtractor.validate!(valid).valid).toBe(true);

		const invalid = standardExtendedTextExtractor.validate!({
			...valid,
			baseType: 'identifier',
			base: 1,
			minStrings: 4,
			maxStrings: 3,
			expectedLines: -1,
			expectedLength: -1,
		});
		expect(invalid.valid).toBe(false);
		expect(invalid.errors).toContain('extendedTextInteraction baseType must be string, integer, or float');
		expect(invalid.errors).toContain('base must be an integer from 2 through 36');
		expect(invalid.errors).toContain('minStrings must not exceed maxStrings');
		expect(invalid.errors).toContain('expectedLines must be a non-negative integer');
		expect(invalid.errors).toContain('expectedLength must be a non-negative integer');
	});
});
