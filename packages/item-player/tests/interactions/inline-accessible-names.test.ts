/**
 * Inline interactions (text entry, inline choice) name themselves without exposing response
 * identifiers, explain a pattern mismatch without exposing the XSD regex, and give the browser
 * no spelling or autocomplete help.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DefaultI18nProvider } from '@pie-qti/i18n';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import {
	inlineInteractionLabel,
	textEntryPatternMessage,
} from '../../src/interactions/inline/accessibleName.js';
import type { TextEntryInteractionData } from '../../src/interactions/shared/types.js';

const position = { index: 2, count: 4 } as const;

describe('inlineInteractionLabel', () => {
	test('names a blank by its position when nothing is authored', () => {
		expect(inlineInteractionLabel(undefined, {}, position)).toBe('Blank 2 of 4');
	});

	test('never names a blank by its response identifier', () => {
		const label = inlineInteractionLabel(undefined, { responseId: 'CAPITAL_PARIS' } as never, position);
		expect(label).not.toContain('CAPITAL_PARIS');
		expect(label).toBe('Blank 2 of 4');
	});

	test('prefers the authored aria label, then the authored title', () => {
		expect(
			inlineInteractionLabel(undefined, { accessibility: { label: 'Capital city' }, title: 'City' }, position)
		).toBe('Capital city');
		expect(inlineInteractionLabel(undefined, { title: 'City' }, position)).toBe('City');
		expect(inlineInteractionLabel(undefined, { accessibility: { label: '  ' }, title: ' ' }, position)).toBe(
			'Blank 2 of 4'
		);
	});

	test('is localized, with the locale digits', async () => {
		const nl = new DefaultI18nProvider('nl');
		await nl.loadLocale('nl');
		expect(inlineInteractionLabel(nl, {}, position)).toBe('Invulplek 2 van 4');
	});
});

describe('textEntryInputMode', () => {
	// The keyboard rule itself lives in `text-entry-input-mode.test.ts`.

	test('the text entry carries its response baseType and authored title', () => {
		const session = createAssessmentItemDefinition({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="numeric" title="Numeric" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="COUNT" cardinality="single" baseType="integer"/>
  <responseDeclaration identifier="RATIO" cardinality="single" baseType="float"/>
  <itemBody><p><textEntryInteraction responseIdentifier="COUNT" title="How many"/> and <textEntryInteraction responseIdentifier="RATIO"/></p></itemBody>
</assessmentItem>`,
		}).openSession();
		try {
			const entries = session
				.present()
				.flow.flatMap((node) => (node.kind === 'interaction' ? [node.mount.interaction] : [])) as TextEntryInteractionData[];
			expect(entries.map((entry) => [entry.responseId, entry.baseType, entry.title])).toEqual([
				['COUNT', 'integer', 'How many'],
				['RATIO', 'float', undefined],
			]);
		} finally {
			session.dispose();
		}
	});
});

describe('textEntryPatternMessage', () => {
	const mask = '[0-9]{2}/[0-9]{2}/[0-9]{4}';

	test('says what is wrong without exposing the pattern mask', () => {
		const message = textEntryPatternMessage(undefined, { placeholderText: '' });
		expect(message).toBe('This answer is not in the expected format.');
		expect(message).not.toContain(mask);
	});

	test('names the expected format by the placeholder hint when the item has one', () => {
		expect(textEntryPatternMessage(undefined, { placeholderText: 'dd/mm/yyyy' })).toBe(
			'This answer is not in the expected format. Use this format: dd/mm/yyyy'
		);
	});

	test("prefers the author's own message", () => {
		expect(
			textEntryPatternMessage(undefined, { patternMaskMessage: 'Enter a date.', placeholderText: 'dd/mm/yyyy' })
		).toBe('Enter a date.');
	});
});

describe('InlineTextEntry input attributes', () => {
	const source = readFileSync(
		new URL('../../src/interactions/text-entry/InlineTextEntry.svelte', import.meta.url),
		'utf8'
	);

	test('offers no spelling, capitalization or autocomplete help', () => {
		expect(source).toContain('spellcheck="false"');
		expect(source).toContain('autocorrect="off"');
		expect(source).toContain('autocapitalize="off"');
		expect(source).toContain('autocomplete="off"');
		expect(source).toContain('inputmode={inputMode}');
	});

	test('never exposes the pattern mask in a tooltip', () => {
		expect(source).not.toMatch(/\btitle=/);
		expect(source).not.toContain('formatHint');
		expect(source).toContain('role="alert"');
		expect(source).toContain('aria-invalid=');
	});
});
