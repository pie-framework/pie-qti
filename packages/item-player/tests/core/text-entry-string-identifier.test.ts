/**
 * textEntryInteraction@stringIdentifier (QTI 2.1/2.2 ASI §5.122.3, carried to QTI 3.0 as
 * `string-identifier`): a string interaction bound to a numeric response can also capture the
 * raw text the candidate entered in a companion string response — "3.50" where the float
 * response is 3.5, "101" where a base-2 integer response is 5. An empty field gives NULL.
 * Completion and validation keep keying off the main response only.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

function companionItem(options: {
	identifier: string;
	baseType: 'integer' | 'float';
	/** Authored on the interaction; defaults to the companion STR. */
	stringIdentifier?: string;
	base?: number;
	correct: string;
	/**
	 * What scores 1: the companion STR stringMatching this lexical text, or — when omitted —
	 * the main response matching its correct response.
	 */
	lexical?: string;
}): string {
	const stringIdentifier = options.stringIdentifier ?? 'STR';
	const base = options.base === undefined ? '' : ` base="${options.base}"`;
	const condition = options.lexical === undefined
		? '<match><variable identifier="NUM"/><correct identifier="NUM"/></match>'
		: `<stringMatch caseSensitive="true" substring="false">
          <variable identifier="STR"/>
          <baseValue baseType="string">${options.lexical}</baseValue>
        </stringMatch>`;
	return `<assessmentItem ${NS} identifier="${options.identifier}" title="t" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="NUM" cardinality="single" baseType="${options.baseType}">
    <correctResponse><value>${options.correct}</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="STR" cardinality="single" baseType="string"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Answer: <textEntryInteraction responseIdentifier="NUM" stringIdentifier="${stringIdentifier}"${base} expectedLength="8"/></p></itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        ${condition}
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;
}

const DECIMAL = companionItem({
	identifier: 'textentry-lexical-decimal',
	baseType: 'float',
	correct: '3.5',
	lexical: '3.50',
});
const BINARY = companionItem({
	identifier: 'textentry-lexical-binary',
	baseType: 'integer',
	base: 2,
	correct: '5',
	lexical: '101',
});
const SELF_COMPANION = companionItem({
	identifier: 'textentry-lexical-self',
	baseType: 'float',
	stringIdentifier: 'NUM',
	correct: '3.5',
});
const GHOST_COMPANION = companionItem({
	identifier: 'textentry-lexical-ghost',
	baseType: 'float',
	stringIdentifier: 'GHOST',
	correct: '3.5',
});
const OUTCOME_COMPANION = companionItem({
	identifier: 'textentry-lexical-outcome',
	baseType: 'float',
	stringIdentifier: 'SCORE',
	correct: '3.5',
});

function versions(itemXml: string): Array<[string, string]> {
	return [
		['QTI 2.2', itemXml],
		['QTI 3.0', convertQti2ToQti3(itemXml)],
	];
}

function withSession<T>(session: ItemSession, run: (session: ItemSession) => T): T {
	try {
		return run(session);
	} finally {
		session.dispose();
	}
}

function scoreAttempt(session: ItemSession): number | undefined {
	return session.dispatch({ action: 'scoreAttempt' }).result?.scoring?.score;
}

function textEntryMount(session: ItemSession): { interaction: any; stringResponse?: unknown } | null {
	const node = session
		.present()
		.flow.find((entry) => entry.kind === 'interaction' && entry.mount.renderer === 'text-entry');
	return node?.kind === 'interaction' ? (node.mount as { interaction: any; stringResponse?: unknown }) : null;
}

describe('textEntryInteraction stringIdentifier', () => {
	describe.each(versions(DECIMAL))('decimal companion (%s)', (_version, itemXml) => {
		test('typing captures the raw text alongside the coerced response and scores on it', () => {
			const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
			withSession(definition.openSession(), (session) => {
				session.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '3.50' });
				expect(session.state().responses.NUM).toBe(3.5);
				expect(session.state().responses.STR).toBe('3.50');
				expect(scoreAttempt(session)).toBe(1);
			});
		});

		test('an empty field gives NULL for the companion', () => {
			const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
			withSession(definition.openSession(), (session) => {
				expect(session.state().responses.STR).toBeNull();
				session.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '3.50' });
				expect(session.state().responses.STR).toBe('3.50');
				session.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '' });
				expect(session.state().responses.STR).toBeNull();
				expect(scoreAttempt(session)).toBe(0);
			});
		});

		test('a restore brings the lexical text back, not the coerced number', () => {
			const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
			const live = definition.openSession();
			live.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '3.50' });
			const saved = live.serialize();
			live.dispose();
			withSession(definition.openSession({ restore: saved }), (restored) => {
				expect(restored.state().responses.NUM).toBe(3.5);
				expect(restored.state().responses.STR).toBe('3.50');
				expect(scoreAttempt(restored)).toBe(1);
				const mount = textEntryMount(restored);
				expect(mount?.interaction.stringIdentifier).toBe('STR');
				expect(mount?.stringResponse).toBe('3.50');
			});
		});
	});

	describe.each(versions(BINARY))('base 2 companion (%s)', (_version, itemXml) => {
		test('typing digits in the base captures them verbatim while the response becomes the number', () => {
			const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
			withSession(definition.openSession(), (session) => {
				session.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '101' });
				expect(session.state().responses.NUM).toBe(5);
				expect(session.state().responses.STR).toBe('101');
				expect(scoreAttempt(session)).toBe(1);
			});
		});
	});

	describe.each(versions(SELF_COMPANION))('stringIdentifier repeats the response identifier (%s)', (_version, itemXml) => {
		test('is ignored safely: the main response is set once and scoring still works', () => {
			const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
			withSession(definition.openSession(), (session) => {
				session.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '3.50' });
				expect(session.state().responses.NUM).toBe(3.5);
				expect(scoreAttempt(session)).toBe(1);
			});
		});
	});

	describe.each(versions(GHOST_COMPANION))('stringIdentifier names no declared response (%s)', (_version, itemXml) => {
		test('is ignored safely: the main response still applies', () => {
			const definition = createAssessmentItemDefinition({ itemXml, role: 'scorer' });
			withSession(definition.openSession(), (session) => {
				session.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '3.50' });
				expect(session.state().responses.NUM).toBe(3.5);
				expect(scoreAttempt(session)).toBe(1);
			});
		});
	});

	test('a stringIdentifier naming a declared outcome is ignored safely', () => {
		withSession(createAssessmentItemDefinition({ itemXml: OUTCOME_COMPANION }).openSession(), (session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'NUM', value: '3.50' });
			expect(session.state().responses.NUM).toBe(3.5);
			// The outcome is not written as though it were the companion response.
			expect(session.state().outcomes.SCORE).toBe(0);
			expect(session.dispatch({ action: 'scoreAttempt' }).result?.scoring?.outcomeValues.SCORE).toBe(1);
		});
	});

	test('completion and validation key off the main response, never the companion', () => {
		const player = new Player({ itemXml: DECIMAL });
		const responses = { NUM: 'abc' };
		player.setResponses(responses);
		// The raw text lives in the companion while the numeric response stays NULL.
		expect(player.getResponses().STR).toBe('abc');
		expect(player.getResponses().NUM).toBeNull();
		// The companion is not an interaction response: validation has no STR entry and the
		// unanswerable numeric response leaves the item unattempted.
		const validation = player.validateResponses(player.getResponses());
		expect(Object.keys(validation.entries)).toEqual(['NUM']);
		expect(player.isAttempted(player.getResponses())).toBe(false);

		const answered = new Player({ itemXml: DECIMAL });
		answered.setResponses({ NUM: '3.50' });
		expect(answered.isAttempted(answered.getResponses())).toBe(true);
		expect(answered.canSubmitResponses(answered.getResponses())).toBe(true);
	});
});
