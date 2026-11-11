/**
 * The one duplicate-identifier check every interaction extractor's `validate` uses.
 *
 * Every choice-like identifier set must flag a missing identifier and a repeat, with wording that
 * names the set — the messages eleven extractors pinned individually before the check was shared.
 */

import { describe, expect, test } from 'bun:test';
import { validateUniqueIdentifiers } from '../../src/extraction/utils.js';

describe('validateUniqueIdentifiers', () => {
	test('flags a missing identifier, naming the set', () => {
		const errors: string[] = [];
		validateUniqueIdentifiers([{ identifier: 'a' }, { identifier: '' }, {}], errors, {
			plural: 'source choices',
			noun: 'source',
		});
		expect(errors).toEqual(['All source choices must have an identifier', 'All source choices must have an identifier']);
	});

	test('flags a repeat, naming the set and the identifier', () => {
		const errors: string[] = [];
		validateUniqueIdentifiers([{ identifier: 'a' }, { identifier: 'b' }, { identifier: 'a' }], errors, {
			plural: 'choices',
			noun: 'choice',
		});
		expect(errors).toEqual(['Duplicate choice identifier: a']);
	});

	test('reads bare-string items, as gapMatchInteraction gaps are strings', () => {
		const errors: string[] = [];
		validateUniqueIdentifiers(['A', '', 'B', 'A'], errors, { plural: 'gaps', noun: 'gap' });
		expect(errors).toEqual(['All gaps must have an identifier', 'Duplicate gap identifier: A']);
	});

	test('a clean set pushes nothing', () => {
		const errors: string[] = [];
		validateUniqueIdentifiers(['A', 'B'], errors, { plural: 'gaps', noun: 'gap' });
		validateUniqueIdentifiers([{ identifier: 'a' }, { identifier: 'b' }], errors, {
			plural: 'choices',
			noun: 'choice',
		});
		expect(errors).toEqual([]);
	});
});
