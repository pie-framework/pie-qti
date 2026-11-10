/**
 * Opening a session with responses the item does not declare fails with a typed
 * `UnknownResponseIdentifierError`, so a host reusing an item element across items can
 * tell the stale-identifier case apart from any other open failure.
 */

import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { UnknownResponseIdentifierError } from '../../src/core/ItemSession.js';

const ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="unknown-response" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody><p>Body</p></itemBody>
</assessmentItem>`;

describe('UnknownResponseIdentifierError', () => {
	test('openSession with an undeclared response identifier throws it, naming the identifier', () => {
		const definition = createAssessmentItemDefinition({ itemXml: ITEM });
		expect(() => definition.openSession({ responses: { NOPE: 'A' } })).toThrow(
			UnknownResponseIdentifierError
		);
		try {
			definition.openSession({ responses: { NOPE: 'A' } });
		} catch (error) {
			expect((error as UnknownResponseIdentifierError).identifier).toBe('NOPE');
			expect((error as UnknownResponseIdentifierError).message).toContain('NOPE');
		}
	});

	test('a declared response identifier opens normally', () => {
		const definition = createAssessmentItemDefinition({ itemXml: ITEM });
		const session = definition.openSession({ responses: { RESPONSE: 'A' } });
		expect(session.state().responses['RESPONSE']).toBe('A');
		session.dispose();
	});
});
