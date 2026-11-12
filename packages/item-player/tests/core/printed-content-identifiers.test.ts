/**
 * The printed-content scan that separates markup-bearing session state from interaction
 * input: the response and context identifiers the body and rubric content substitute live
 * through `printedVariable`. The presentation cache (ItemBody) keys on these sets — the
 * response set since it landed, the context set since `duration`'s blanket cache skip froze
 * printed elapsed time for a whole attempt — so the sets must report exactly the variables
 * of each kind the markup renders, and be stable per session.
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

function playerFor(itemBody: string, rubric = ''): Player {
	return new Player({
		itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="printed-scan" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	${rubric}
	<itemBody>${itemBody}</itemBody>
</assessmentItem>`,
	});
}

describe('printed content identifiers', () => {
	test('a printed response is a printed response identifier, not a printed context one', () => {
		const player = playerFor(
			'<p>You typed: <printedVariable identifier="RESPONSE"/>.</p>',
			'<rubricblock><p>Score: <printedVariable identifier="SCORE"/>.</p></rubricblock>',
		);
		expect([...player.getResponseIdentifiersPrintedInContent()]).toEqual(['RESPONSE']);
		expect([...player.getContextIdentifiersPrintedInContent()]).toEqual([]);
		// An outcome is neither: the cache compares outcomes wholesale, not through these sets.
		expect(player.getResponseIdentifiersPrintedInContent().has('SCORE')).toBe(false);
		expect(player.getContextIdentifiersPrintedInContent().has('SCORE')).toBe(false);
	});

	test('a printed built-in `duration` is a printed context identifier', () => {
		const player = playerFor(
			'<p>Elapsed: <printedVariable identifier="duration"/> s.</p>',
		);
		expect([...player.getResponseIdentifiersPrintedInContent()]).toEqual([]);
		expect([...player.getContextIdentifiersPrintedInContent()]).toEqual(['duration']);
	});

	test('printed built-in attempt state reports as context, alongside declared context variables', () => {
		const player = playerFor(
			'<p>' +
				'<printedVariable identifier="numAttempts"/> ' +
				'<printedVariable identifier="completionStatus"/> ' +
				'<printedVariable identifier="QTI_CONTEXT"/> ' +
				'</p>',
		);
		const contextIds = player.getContextIdentifiersPrintedInContent();
		expect(contextIds.has('numAttempts')).toBe(true);
		expect(contextIds.has('completionStatus')).toBe(true);
		expect(contextIds.has('QTI_CONTEXT')).toBe(true);
	});

	test('the sets are stable per session: the same frozen set comes back', () => {
		const player = playerFor('<p><printedVariable identifier="duration"/>.</p>');
		expect(player.getResponseIdentifiersPrintedInContent()).toBe(
			player.getResponseIdentifiersPrintedInContent(),
		);
		expect(player.getContextIdentifiersPrintedInContent()).toBe(
			player.getContextIdentifiersPrintedInContent(),
		);
	});

	test('a body printing nothing reports both sets empty', () => {
		const player = playerFor('<p>Plain text with <textEntryInteraction responseIdentifier="RESPONSE"/>.</p>');
		expect(player.getResponseIdentifiersPrintedInContent().size).toBe(0);
		expect(player.getContextIdentifiersPrintedInContent().size).toBe(0);
	});
});
