/**
 * QTI ASI stringInteraction `base` (carried into 2.2 and 3.0): a string interaction bound to a
 * numeric response reads the value the candidate enters in that number base. The base applies
 * to typed text only. A value that already is a number — a restored session, a correct
 * response or default, a value read back from the session — is the variable's value and passes
 * through unchanged; reading it in the base again would change it on every round trip.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

function numericItem(options: {
	identifier: string;
	interaction: string;
	baseType: 'integer' | 'float';
	cardinality?: 'single' | 'multiple';
	correct: readonly string[];
	defaultValue?: string;
}): string {
	const values = (list: readonly string[]) => list.map((value) => `<value>${value}</value>`).join('');
	return `<assessmentItem ${NS} identifier="${options.identifier}" title="t" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="${options.cardinality ?? 'single'}" baseType="${options.baseType}">
    ${options.defaultValue === undefined ? '' : `<defaultValue>${values([options.defaultValue])}</defaultValue>`}
    <correctResponse>${values(options.correct)}</correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody><p>Answer: ${options.interaction}</p></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;
}

const HEX_EXTENDED = numericItem({
	identifier: 'hex-extended',
	interaction: '<extendedTextInteraction responseIdentifier="RESPONSE" base="16"/>',
	baseType: 'integer',
	correct: ['255'],
	defaultValue: '10',
});
const BINARY_EXTENDED = numericItem({
	identifier: 'binary-extended',
	interaction: '<extendedTextInteraction responseIdentifier="RESPONSE" base="2"/>',
	baseType: 'integer',
	correct: ['5'],
});
const HEX_FLOAT_EXTENDED = numericItem({
	identifier: 'hex-float-extended',
	interaction: '<extendedTextInteraction responseIdentifier="RESPONSE" base="16"/>',
	baseType: 'float',
	correct: ['10.5'],
});
const HEX_MULTIPLE_EXTENDED = numericItem({
	identifier: 'hex-multiple-extended',
	interaction: '<extendedTextInteraction responseIdentifier="RESPONSE" base="16" maxStrings="2"/>',
	baseType: 'integer',
	cardinality: 'multiple',
	correct: ['10', '255'],
});
const DECIMAL_EXTENDED = numericItem({
	identifier: 'decimal-extended',
	interaction: '<extendedTextInteraction responseIdentifier="RESPONSE"/>',
	baseType: 'float',
	correct: ['12.5'],
});
const BINARY_TEXT_ENTRY = numericItem({
	identifier: 'binary-text-entry',
	interaction: '<textEntryInteraction responseIdentifier="RESPONSE" base="2"/>',
	baseType: 'integer',
	correct: ['5'],
});
const HEX_FLOAT_TEXT_ENTRY = numericItem({
	identifier: 'hex-float-text-entry',
	interaction: '<textEntryInteraction responseIdentifier="RESPONSE" base="16"/>',
	baseType: 'float',
	correct: ['10.5'],
});
const DECIMAL_TEXT_ENTRY = numericItem({
	identifier: 'decimal-text-entry',
	interaction: '<textEntryInteraction responseIdentifier="RESPONSE" base="10"/>',
	baseType: 'integer',
	correct: ['12'],
});

function withSession<T>(session: ItemSession, run: (session: ItemSession) => T): T {
	try {
		return run(session);
	} finally {
		session.dispose();
	}
}

function score(session: ItemSession): number | undefined {
	return session.dispatch({ action: 'scoreAttempt' }).result?.scoring?.score;
}

function versions(itemXml: string): Array<[string, string]> {
	return [
		['QTI 2.2', itemXml],
		['QTI 3.0', convertQti2ToQti3(itemXml)],
	];
}

const TWO_BASES_EXTENDED = `<assessmentItem ${NS} identifier="two-bases-extended" title="Two bases" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="HEX" cardinality="single" baseType="integer">
    <correctResponse><value>255</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="BIN" cardinality="single" baseType="integer">
    <correctResponse><value>5</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody><p>Hex: <extendedTextInteraction responseIdentifier="HEX" base="16"/></p><p>Binary: <extendedTextInteraction responseIdentifier="BIN" base="2"/></p></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

describe('extendedTextInteraction base', () => {
	describe.each(versions(HEX_EXTENDED))('base 16, integer (%s)', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });

		test('typed text reads in the base; the value survives repeated save and restore', () => {
			const live = definition.openSession({ responses: { RESPONSE: 'FF' } });
			expect(live.state().responses.RESPONSE).toBe(255);
			expect(score(live)).toBe(1);
			let snapshot = live.serialize();
			live.dispose();
			for (let round = 0; round < 3; round++) {
				const restored = definition.openSession({ restore: snapshot });
				expect(restored.state().responses.RESPONSE).toBe(255);
				expect(score(restored)).toBe(1);
				snapshot = restored.serialize();
				restored.dispose();
			}
		});

		test('a number read back from the session applies unchanged', () => {
			withSession(definition.openSession({ responses: { RESPONSE: 255 } }), (session) => {
				expect(session.state().responses.RESPONSE).toBe(255);
				expect(score(session)).toBe(1);
				session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'ff' });
				expect(session.state().responses.RESPONSE).toBe(255);
			});
		});

		test('the declared correct response and default survive restore unchanged', () => {
			const first = definition.openSession();
			expect(first.state().responses.RESPONSE).toBe(10);
			const saved = first.serialize();
			first.dispose();
			expect(saved.responseVariables.RESPONSE?.correctResponse).toBe(255);
			withSession(definition.openSession({ restore: saved }), (restored) => {
				const variable = restored.serialize().responseVariables.RESPONSE;
				expect(variable?.correctResponse).toBe(255);
				expect(variable?.defaultValue).toBe(10);
				expect(variable?.value).toBe(10);
				restored.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'FF' });
				expect(score(restored)).toBe(1);
			});
		});
	});

	test.each(versions(BINARY_EXTENDED))('base 2, integer (%s): a restored value is kept, not read in base 2', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		const live = definition.openSession({ responses: { RESPONSE: '101' } });
		expect(live.state().responses.RESPONSE).toBe(5);
		const saved = live.serialize();
		live.dispose();
		withSession(definition.openSession({ restore: saved }), (restored) => {
			expect(restored.state().responses.RESPONSE).toBe(5);
			expect(score(restored)).toBe(1);
		});
	});

	test.each(versions(HEX_FLOAT_EXTENDED))('base 16, float (%s): a fractional value round-trips', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		const live = definition.openSession({ responses: { RESPONSE: 'A.8' } });
		expect(live.state().responses.RESPONSE).toBe(10.5);
		const saved = live.serialize();
		live.dispose();
		withSession(definition.openSession({ restore: saved }), (restored) => {
			expect(restored.state().responses.RESPONSE).toBe(10.5);
			expect(score(restored)).toBe(1);
		});
	});

	test.each(versions(HEX_MULTIPLE_EXTENDED))('base 16, multiple (%s): typed strings and numbers mix per value', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		const live = definition.openSession({ responses: { RESPONSE: ['A', 'FF'] } });
		expect(live.state().responses.RESPONSE).toEqual([10, 255]);
		const saved = live.serialize();
		live.dispose();
		withSession(definition.openSession({ restore: saved }), (restored) => {
			expect(restored.state().responses.RESPONSE).toEqual([10, 255]);
			expect(restored.serialize().responseVariables.RESPONSE?.correctResponse).toEqual([10, 255]);
			expect(score(restored)).toBe(1);
			restored.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: [10, 'ff'] });
			expect(restored.state().responses.RESPONSE).toEqual([10, 255]);
		});
	});

	test.each(versions(DECIMAL_EXTENDED))('decimal base (%s): unchanged', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		const live = definition.openSession({ responses: { RESPONSE: '12.5' } });
		expect(live.state().responses.RESPONSE).toBe(12.5);
		const saved = live.serialize();
		live.dispose();
		withSession(definition.openSession({ restore: saved }), (restored) => {
			expect(restored.state().responses.RESPONSE).toBe(12.5);
			expect(restored.serialize().responseVariables.RESPONSE?.correctResponse).toBe(12.5);
			expect(score(restored)).toBe(1);
		});
		withSession(definition.openSession({ responses: { RESPONSE: 12.5 } }), (session) => {
			expect(session.state().responses.RESPONSE).toBe(12.5);
		});
	});
});

describe('textEntryInteraction base', () => {
	test.each(versions(BINARY_TEXT_ENTRY))('base 2, integer (%s): typed input reads in base 2', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		const live = definition.openSession({ responses: { RESPONSE: '101' } });
		expect(live.state().responses.RESPONSE).toBe(5);
		expect(score(live)).toBe(1);
		const saved = live.serialize();
		live.dispose();
		withSession(definition.openSession({ restore: saved }), (restored) => {
			expect(restored.state().responses.RESPONSE).toBe(5);
			expect(restored.serialize().responseVariables.RESPONSE?.correctResponse).toBe(5);
			expect(score(restored)).toBe(1);
		});
		// A digit outside the base is not a base-2 number.
		withSession(definition.openSession({ responses: { RESPONSE: '102' } }), (session) => {
			expect(session.state().responses.RESPONSE).toBeNull();
			expect(score(session)).toBe(0);
		});
	});

	test.each(versions(HEX_FLOAT_TEXT_ENTRY))('base 16, float (%s): typed input reads in base 16', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		withSession(definition.openSession({ responses: { RESPONSE: 'a.8' } }), (session) => {
			expect(session.state().responses.RESPONSE).toBe(10.5);
			expect(score(session)).toBe(1);
		});
	});

	test.each(versions(DECIMAL_TEXT_ENTRY))('base 10 (%s): unchanged', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		withSession(definition.openSession({ responses: { RESPONSE: '012' } }), (session) => {
			expect(session.state().responses.RESPONSE).toBe(12);
			expect(score(session)).toBe(1);
		});
		withSession(definition.openSession({ responses: { RESPONSE: 12 } }), (session) => {
			expect(session.state().responses.RESPONSE).toBe(12);
		});
	});

	test.each(versions(BINARY_TEXT_ENTRY))('the interaction data carries an authored base (%s)', (_version, itemXml) => {
		const definition = createAssessmentItemDefinition({ itemXml });
		withSession(definition.openSession(), (session) => {
			const node = session
				.present()
				.flow.find((entry) => entry.kind === 'interaction' && entry.mount.interaction.type === 'textEntryInteraction');
			expect(node?.kind).toBe('interaction');
			expect((node as { mount: { interaction: { base?: number } } }).mount.interaction.base).toBe(2);
		});
	});

	test.each(versions(TWO_BASES_EXTENDED))('two extended-text interactions in one item keep their own bases (%s)', (_version, itemXml) => {
		// The bases are cached per interaction identifier: each response reads its own
		// interaction's base, whichever is looked up first.
		const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
		withSession(definition.openSession({ responses: { HEX: 'ff', BIN: '101' } }), (session) => {
			expect(session.state().responses.HEX).toBe(255);
			expect(session.state().responses.BIN).toBe(5);
		});
		withSession(definition.openSession({ responses: { BIN: '101', HEX: 'ff' } }), (session) => {
			expect(session.state().responses.BIN).toBe(5);
			expect(session.state().responses.HEX).toBe(255);
		});
	});
});
