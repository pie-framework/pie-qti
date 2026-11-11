/**
 * The built-in `completionStatus` variable, per the QTI ASI §5.2.1 transitions table (QTI 2.1
 * §5.2.1 and its 2.2/3.0 equivalents): `not_attempted` when the item session is registered,
 * `unknown` once the attempt has begun (the candidate's first response change, a mounted PCI
 * module reporting its own change, or activating a suspended handoff for interaction), and
 * `completed` when response processing completes the attempt — the submission of a
 * non-adaptive item, or an adaptive item's own rules. The engine never assigns `incomplete`
 * itself; response processing rules that assign it own that value.
 *
 * Pinned per event, because consumers read completionStatus from the session view to decide
 * deliverability and progress: a response change must move `not_attempted` to `unknown`
 * before the view of that dispatch is built, and a restore must never invent an attempt.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession, OpenItemSessionOptions } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** Non-adaptive; response processing decides the score and the submission completes. */
const CHOICE_ITEM = `<assessmentItem ${NS} identifier="cs-choice" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
			<simpleChoice identifier="B">B</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** Adaptive, and its response processing never sets completionStatus. */
const ADAPTIVE_OPEN_ITEM = `<assessmentItem ${NS} identifier="cs-adaptive-open" adaptive="true" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
			<simpleChoice identifier="B">B</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** Adaptive, completed by its own rule when the second attempt answers correctly. */
const ADAPTIVE_COMPLETING_ITEM = `<assessmentItem ${NS} identifier="cs-adaptive-completing" adaptive="true" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
			<simpleChoice identifier="B">B</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<and>
					<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
					<match><variable identifier="numAttempts"/><baseValue baseType="integer">2</baseValue></match>
				</and>
				<setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
				<setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>
			</responseIf>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const openSessions: ItemSession[] = [];

function open(itemXml: string): ItemSession {
	const session = createAssessmentItemDefinition({ itemXml }).openSession();
	openSessions.push(session);
	return session;
}

function openWith(options: OpenItemSessionOptions): ItemSession {
	const session = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM }).openSession(options);
	openSessions.push(session);
	return session;
}

afterEach(() => {
	for (const session of openSessions.splice(0)) session.dispose();
});

describe('completionStatus transitions (QTI ASI §5.2.1)', () => {
	test('a registered session is not_attempted', () => {
		const session = open(CHOICE_ITEM);
		expect(session.state().completionStatus).toBe('not_attempted');
	});

	test('the first candidate response change moves not_attempted to unknown, and it stays unknown', () => {
		const session = open(CHOICE_ITEM);
		const statuses: Array<string | undefined> = [];
		session.subscribe(({ current }) => statuses.push(current.completionStatus));

		const first = session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		expect(first.current.completionStatus).toBe('unknown');
		expect(session.state().completionStatus).toBe('unknown');

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
		// The attempt has begun; a later change does not restart the transition table.
		expect(statuses).toEqual(['unknown', 'unknown']);
		expect(session.state().completionStatus).toBe('unknown');
	});

	test('a setResponses dispatch begins the attempt the same way', () => {
		const session = open(CHOICE_ITEM);
		session.dispatch({ action: 'setResponses', responses: { RESPONSE: 'A' } });
		expect(session.state().completionStatus).toBe('unknown');
	});

	test('pre-seeded openSession responses count as the attempt having begun', () => {
		// Documented reading of an ambiguous edge (see Player.beginAttempt): the override
		// flows through the candidate response-change path.
		const seeded = openWith({ responses: { RESPONSE: 'A' } });
		expect(seeded.state().completionStatus).toBe('unknown');
	});

	test('submitting a non-adaptive item completes it', () => {
		const session = open(CHOICE_ITEM);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
		const submitted = session.dispatch({ action: 'endAttempt' });
		expect(submitted.result?.completionStatus).toBe('completed');
		expect(submitted.current.completionStatus).toBe('completed');
		expect(session.state().completionStatus).toBe('completed');
	});

	test('scoreAttempt scores without completing: the attempt stays unknown', () => {
		const session = open(CHOICE_ITEM);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		const scored = session.dispatch({ action: 'scoreAttempt' });
		expect(scored.result?.completionStatus).toBe('unknown');
		expect(session.state().completionStatus).toBe('unknown');
	});

	test('an adaptive item stays unknown across attempts until its rules complete it', () => {
		const session = open(ADAPTIVE_COMPLETING_ITEM);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
		const firstAttempt = session.dispatch({ action: 'submitAttempt' });
		expect(firstAttempt.result?.completionStatus).toBe('unknown');
		expect(firstAttempt.result?.completed).toBe(false);

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		const secondAttempt = session.dispatch({ action: 'submitAttempt' });
		expect(secondAttempt.result?.completionStatus).toBe('completed');
		expect(session.state().completionStatus).toBe('completed');
	});

	test('an adaptive item whose rules never complete stays unknown, not completed', () => {
		const session = open(ADAPTIVE_OPEN_ITEM);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		const attempt = session.dispatch({ action: 'submitAttempt' });
		expect(attempt.result?.completed).toBe(false);
		expect(attempt.current.numAttempts).toBe(1);
		expect(session.state().completionStatus).toBe('unknown');
	});

	test('a suspended session keeps its saved status, and activating it begins the attempt', () => {
		const session = open(CHOICE_ITEM);
		const saved = session.dispatch({ action: 'suspendAttempt' }).result?.sessionState;
		expect(saved?.completionStatus).toBe('not_attempted');

		// Restoring keeps the saved status: state replacement is not an attempt.
		const restored = openWith({ restore: saved });
		expect(restored.state().completionStatus).toBe('not_attempted');

		// Resuming hands the item back to the candidate: the attempt has begun.
		const activated = openWith({ restore: saved, activate: true });
		expect(activated.state().completionStatus).toBe('unknown');
	});

	test('a completed attempt stays completed across suspend and restore', () => {
		const session = open(CHOICE_ITEM);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		session.dispatch({ action: 'endAttempt' });
		const restored = openWith({ restore: session.serialize() });
		expect(restored.state().completionStatus).toBe('completed');
	});
});
