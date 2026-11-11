import { afterEach, describe, expect, test } from 'bun:test';
import {
	createInteractionShell,
	parseJsonProp,
	parseListResponseProp,
	responseProp,
} from '../../../src/shared/utils/webComponentHelpers.js';

/**
 * Capture console warnings for a test: the invalid-attribute diagnostic is once
 * per distinct text, and the assertions read what the console was told.
 */
function captureWarnings(): { warnings: string[]; restore(): void } {
	const warnings: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => {
		warnings.push(args.map((arg) => String(arg)).join(' '));
	};
	return {
		warnings,
		restore() {
			console.warn = original;
		},
	};
}

describe('parseJsonProp', () => {
	test('returns undefined for null-ish values', () => {
		expect(parseJsonProp(null)).toBeUndefined();
		expect(parseJsonProp(undefined)).toBeUndefined();
		expect(parseJsonProp('null')).toBeUndefined();
	});

	test('parses valid JSON object strings', () => {
		expect(parseJsonProp<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
	});

	test('keeps an object prop as given', () => {
		const interaction = { responseId: 'R1' };
		expect(parseJsonProp(interaction)).toBe(interaction);
	});

	test('reads non-object text as no value and warns once per distinct text', () => {
		const { warnings, restore } = captureWarnings();
		try {
			// A truncated attribute — the text a long interaction attribute becomes when a
			// host's templating cuts it off.
			expect(parseJsonProp<{ choices: unknown }>('{"choices":')).toBeUndefined();
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('not the JSON object');

			// The same text again: still no value, no repeated warning.
			expect(parseJsonProp<{ choices: unknown }>('{"choices":')).toBeUndefined();
			expect(warnings).toHaveLength(1);

			// JSON of another shape is equally not the object the prop requires.
			expect(parseJsonProp<number>('42')).toBeUndefined();
			expect(parseJsonProp<string>('"a plain string"')).toBeUndefined();
			expect(parseJsonProp<unknown[]>('[1,2]')).toBeUndefined();
			expect(warnings).toHaveLength(4);
		} finally {
			restore();
		}
	});

	test('a valid object warns nothing', () => {
		const { warnings, restore } = captureWarnings();
		try {
			expect(parseJsonProp('{"a":1}')).toEqual({ a: 1 });
			expect(warnings).toHaveLength(0);
		} finally {
			restore();
		}
	});
});

describe('createInteractionShell with a broken interaction attribute', () => {
	test('reads truncated JSON as no interaction: the component shows its no-data state', () => {
		const { warnings, restore } = captureWarnings();
		try {
			const shell = createInteractionShell<{ responseId: string }, string>({
				interaction: '{"responseId":"R1","choices":',
				response: 'A',
			});

			expect(shell.interaction).toBeUndefined();
			expect(shell.responseId).toBeUndefined();
			// The response is unaffected: it is a value, not JSON text.
			expect(shell.response).toBe('A');
			expect(shell.isShowingCorrect).toBe(false);
			expect(warnings).toHaveLength(1);
		} finally {
			restore();
		}
	});
});

// A response is a value. A string response is the candidate's text (or a choice identifier), so
// text that reads as JSON stays that text.
describe('responseProp', () => {
	test.each(['1.50', '1e5', 'true', 'false', 'null', '"quoted"', '[1]', '{"a":1}'])(
		'keeps the string %s exactly as given',
		(value) => {
			expect(responseProp(value)).toBe(value);
		},
	);

	test('keeps lists, records, numbers and booleans as the same values', () => {
		const list = ['A', 'B'];
		const record = { stringValue: '1.50' };
		expect(responseProp(list)).toBe(list);
		expect(responseProp(record)).toBe(record);
		expect(responseProp(0)).toBe(0);
		expect(responseProp(false)).toBe(false);
		expect(responseProp('')).toBe('');
	});

	test('reads null as no response', () => {
		expect(responseProp(null)).toBeUndefined();
		expect(responseProp(undefined)).toBeUndefined();
	});
});

// Identifier-list interactions may receive their list as the JSON text an HTML attribute carries.
// A string that reads as a JSON array is that list; every other string stays as given.
describe('parseListResponseProp', () => {
	test('reads a string that reads as a JSON array as that list', () => {
		expect(parseListResponseProp<string[]>('["A","B"]')).toEqual(['A', 'B']);
		expect(parseListResponseProp<string[]>(' [ "A" ] ')).toEqual(['A']);
		expect(parseListResponseProp<string[]>('[]')).toEqual([]);
	});

	test.each(['true', 'false', 'null', '1.50', '["1"', '"A"', 'A', '[A]'])(
		'keeps any other string as given: %s',
		(value) => {
			expect(parseListResponseProp(value)).toBe(value);
		},
	);

	test('keeps a list given as a value, and reads null as none', () => {
		const list = ['A'];
		expect(parseListResponseProp(list)).toBe(list);
		expect(parseListResponseProp(null)).toBeUndefined();
	});
});

describe('createInteractionShell with listResponse', () => {
	test('reads attribute lists and keeps identifier strings', () => {
		const shell = createInteractionShell<{ responseId: string }, string | string[], string | string[]>({
			interaction: { responseId: 'RESPONSE' },
			response: '["H1","H3"]',
			correctResponse: '["H1"]',
			role: 'scorer',
			listResponse: true,
		});

		expect(shell.response).toEqual(['H1', 'H3']);
		expect(shell.correctResponse).toEqual(['H1']);
		expect(shell.isShowingCorrect).toBe(true);
	});

	test('never reads identifier strings such as true or null as JSON', () => {
		const shell = createInteractionShell<{ responseId: string }, string | string[], string | string[]>({
			interaction: { responseId: 'RESPONSE' },
			response: 'true',
			correctResponse: 'null',
			role: 'scorer',
			listResponse: true,
		});

		expect(shell.response).toBe('true');
		expect(shell.correctResponse).toBe('null');
		expect(shell.isShowingCorrect).toBe(true);
	});
});
