import { describe, expect, test } from 'bun:test';
import {
	createExtendedTextNumericRecord,
	createExtendedTextResponse,
	createExtendedTextStringResponse,
	extendedTextResponseToStrings,
} from '../../src/interactions/extended-text/response.js';

describe('extended text response semantics', () => {
	test('produces every exact QTI numeric record field', () => {
		expect(createExtendedTextNumericRecord('0012.30e-1', 10)).toEqual({
			stringValue: '0012.30e-1',
			floatValue: 1.23,
			integerValue: null,
			leftDigits: 4,
			rightDigits: 2,
			ndp: 3,
			nsf: 4,
			exponent: -1,
		});
	});

	test('uses the authored number base', () => {
		expect(createExtendedTextNumericRecord('FF', 16)).toEqual({
			stringValue: 'FF',
			floatValue: 255,
			integerValue: 255,
			leftDigits: 2,
			rightDigits: 0,
			ndp: 0,
			nsf: 2,
			exponent: null,
		});
	});

	test('keeps string values single, multiple, and ordered as declared', () => {
		const single = { cardinality: 'single', baseType: 'string', base: 10 } as const;
		const multiple = { cardinality: 'multiple', baseType: 'string', base: 10 } as const;
		const ordered = { cardinality: 'ordered', baseType: 'string', base: 10 } as const;

		expect(createExtendedTextResponse(['essay'], single)).toBe('essay');
		expect(createExtendedTextResponse(['first', '', 'second'], multiple)).toEqual(['first', 'second']);
		expect(createExtendedTextResponse(['first', 'second'], ordered)).toEqual(['first', 'second']);
		expect(createExtendedTextResponse([''], multiple)).toEqual([]);
	});

	test('coerces numeric single and container responses without losing the companion strings', () => {
		const integer = { cardinality: 'single', baseType: 'integer', base: 16 } as const;
		const floats = { cardinality: 'ordered', baseType: 'float', base: 10 } as const;

		expect(createExtendedTextResponse(['FF'], integer)).toBe(255);
		expect(createExtendedTextResponse(['1.5', '-2e1'], floats)).toEqual([1.5, -20]);
		expect(createExtendedTextStringResponse(['FF'], 'single')).toBe('FF');
		expect(createExtendedTextStringResponse(['1.5', '', '-2e1'], 'ordered')).toEqual(['1.5', '-2e1']);
	});

	test('round-trips record editor text through the public response shape', () => {
		const interaction = { cardinality: 'record', base: 10 } as const;
		const response = createExtendedTextResponse(['1.2300'], interaction);

		expect(response).toMatchObject({ stringValue: '1.2300', floatValue: 1.23, nsf: 5 });
		expect(extendedTextResponseToStrings(response, interaction)).toEqual(['1.2300']);
	});

	test('returns NULL-like empty values for optional single and record responses', () => {
		expect(
			createExtendedTextResponse([''], { cardinality: 'single', baseType: 'string', base: 10 }),
		).toBeNull();
		expect(createExtendedTextResponse([''], { cardinality: 'record', base: 10 })).toBeNull();
		expect(
			createExtendedTextResponse(['<p><br></p>'], {
				cardinality: 'single',
				baseType: 'string',
				base: 10,
				format: 'xhtml',
			}),
		).toBeNull();
	});
});
