/**
 * Tests for the placeholder-name comparison in `scripts/check-translations.ts`.
 *
 * Key parity alone let a locale rename `{count}` to `{total}` or drop a
 * placeholder the English message requires — the literal `{name}` then renders
 * to the candidate (round-4 review, finding L3).
 */

import { describe, expect, test } from 'bun:test';
import { placeholderNames, placeholderViolation } from '../scripts/check-translations.js';

describe('placeholderNames', () => {
	test('collects unique names in order of first appearance', () => {
		expect(placeholderNames('{count} of {total}, {count} again')).toEqual(['count', 'total']);
	});

	test('returns an empty list for messages without placeholders', () => {
		expect(placeholderNames('No placeholders here')).toEqual([]);
	});
});

describe('placeholderViolation', () => {
	test('accepts an exact name match', () => {
		expect(placeholderViolation('common.deselected', '{item} deselected', '{item} deseleccionado')).toBeNull();
	});

	test('rejects a renamed placeholder', () => {
		const violation = placeholderViolation('common.deselected', '{item} deselected', '{elemento} deseleccionado');
		expect(violation).toContain('{item}');
		expect(violation).toContain('{elemento}');
	});

	test('rejects a dropped placeholder on a regular key', () => {
		const violation = placeholderViolation('common.deselected', '{item} deselected', 'deseleccionado');
		expect(violation).toContain('{item}');
	});

	test('rejects an invented placeholder en does not carry', () => {
		const violation = placeholderViolation('common.submitted', 'Submitted', 'Enviado {cuando}');
		expect(violation).toContain('{cuando}');
	});

	test('accepts a plural leaf that spells the number out instead of {count}', () => {
		// Documented ro/ar `.one` forms: complete sentences without the placeholder.
		expect(placeholderViolation('plurals.items.one', '{count} item', 'Mai este un element')).toBeNull();
	});

	test('rejects a plural leaf that invents a placeholder name', () => {
		const violation = placeholderViolation('plurals.items.one', '{count} item', '{total} element');
		expect(violation).toContain('{total}');
	});

	test('rejects a renamed placeholder on a plural leaf', () => {
		const violation = placeholderViolation('interactions.hottext.selectAtLeast', 'Select at least {minChoices}', 'Seleziona almeno {min}');
		expect(violation).toContain('{min}');
	});
});
