/**
 * QTI ASI §5.1 (carried into 2.2 and 3.0): the built-in `numAttempts` starts at 0 and is
 * incremented at the start of each attempt, so the response processing that ends an attempt
 * reads that attempt's own number — 1 on the first attempt. Items branch on it to penalise a
 * later attempt. An attempt that is not counted (`countAttempt="false"`, a hint) does not
 * increment it, and neither does a scoring pass (`scoreAttempt`).
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { SerializedItemSessionState } from '../../src/types/index.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** Full credit on the first attempt, half on a later one; SEEN records what RP read. */
const PENALTY_ITEM = `<assessmentItem ${NS} identifier="penalty" title="penalty" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="SEEN" cardinality="single" baseType="integer"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <p><endAttemptInteraction responseIdentifier="HINT" title="Hint" countAttempt="false"/></p>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="SEEN"><variable identifier="numAttempts"/></setOutcomeValue>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <responseCondition>
          <responseIf>
            <gt><variable identifier="numAttempts"/><baseValue baseType="integer">1</baseValue></gt>
            <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0.5</baseValue></setOutcomeValue>
          </responseIf>
          <responseElse>
            <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
          </responseElse>
        </responseCondition>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

/** The adaptive counterpart, for parity: SEEN records the numAttempts its RP read. */
const ADAPTIVE_ITEM = PENALTY_ITEM.replace('adaptive="false"', 'adaptive="true"').replace(
	'identifier="penalty"',
	'identifier="penalty-adaptive"',
);

/** A writable reopen of a session whose counted attempt ended, keeping its attempt count. */
function reopenable(state: SerializedItemSessionState): SerializedItemSessionState {
	return { ...state, lifecycleStatus: 'interacting' };
}

describe.each([
	['QTI 2.2', PENALTY_ITEM],
	['QTI 3.0', convertQti2ToQti3(PENALTY_ITEM)],
])('numAttempts during response processing of a non-adaptive item (%s)', (_version, itemXml) => {
	const definition = createAssessmentItemDefinition({ itemXml });

	test('a counted attempt is numbered before response processing reads it', () => {
		const session = definition.openSession({ responses: { RESPONSE: 'A' } });
		try {
			expect(session.state().numAttempts).toBe(0);
			const ended = session.dispatch({ action: 'endAttempt' });
			const scoring = ended.result?.scoring;
			// Response processing ran as attempt 1.
			expect(scoring?.outcomeValues.SEEN).toBe(1);
			expect(scoring?.score).toBe(1);
			// The count after the attempt is unchanged by the timing: still 1, everywhere.
			expect(scoring?.outcomeValues.numAttempts).toBe(1);
			expect(ended.result?.numAttempts).toBe(1);
			expect(ended.current.numAttempts).toBe(1);
			const saved = session.serialize();
			expect(saved.numAttempts).toBe(1);
			expect(saved.contextVariables.numAttempts?.value).toBe(1);
		} finally {
			session.dispose();
		}
	});

	test('a second counted attempt reads 2 and takes the later-attempt credit', () => {
		const first = definition.openSession({ responses: { RESPONSE: 'B' } });
		const afterFirst = first.dispatch({ action: 'endAttempt' });
		expect(afterFirst.result?.scoring?.outcomeValues.SEEN).toBe(1);
		expect(afterFirst.result?.scoring?.score).toBe(0);
		// The host reopens the item for its next attempt from the counted attempt's state.
		const reopened = definition.openSession({ restore: reopenable(first.serialize()) });
		first.dispose();
		try {
			expect(reopened.state().numAttempts).toBe(1);
			reopened.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			const second = reopened.dispatch({ action: 'endAttempt' });
			expect(second.result?.scoring?.outcomeValues.SEEN).toBe(2);
			expect(second.result?.scoring?.score).toBe(0.5);
			expect(second.current.numAttempts).toBe(2);
		} finally {
			reopened.dispose();
		}
	});

	test('restore reads the attempt count from contextVariables.numAttempts', () => {
		const first = definition.openSession({ responses: { RESPONSE: 'B' } });
		const preAttempt = first.serialize();
		first.dispatch({ action: 'endAttempt' });
		const postAttempt = first.serialize();
		first.dispose();
		// A pre-attempt snapshot carries the count before the attempt; patching its context
		// variable to the counted attempt's value is what a reopen must carry.
		const patched: SerializedItemSessionState = {
			...preAttempt,
			numAttempts: postAttempt.numAttempts,
			contextVariables: {
				...preAttempt.contextVariables,
				numAttempts: postAttempt.contextVariables.numAttempts!,
			},
		};
		const reopened = definition.openSession({ restore: patched, responses: { RESPONSE: 'A' } });
		try {
			const second = reopened.dispatch({ action: 'endAttempt' });
			expect(second.result?.scoring?.outcomeValues.SEEN).toBe(2);
			expect(second.result?.scoring?.score).toBe(0.5);
		} finally {
			reopened.dispose();
		}
	});

	test('an uncounted attempt (countAttempt=false) neither increments nor numbers the run', () => {
		const session = definition.openSession({ responses: { RESPONSE: 'A', HINT: true } });
		try {
			const hint = session.dispatch({ action: 'endAttempt', countAttempt: false });
			expect(hint.result?.scoring?.outcomeValues.SEEN).toBe(0);
			expect(hint.current.numAttempts).toBe(0);
			expect(hint.current.lifecycleStatus).toBe('interacting');
			// The counted attempt that follows is still attempt 1.
			const counted = session.dispatch({ action: 'endAttempt' });
			expect(counted.result?.scoring?.outcomeValues.SEEN).toBe(1);
			expect(counted.result?.scoring?.score).toBe(1);
			expect(counted.current.numAttempts).toBe(1);
		} finally {
			session.dispose();
		}
	});

	test('scoreAttempt reads the current count without incrementing it', () => {
		const fresh = definition.openSession({ responses: { RESPONSE: 'A' } });
		try {
			const scored = fresh.dispatch({ action: 'scoreAttempt' });
			expect(scored.result?.scoring?.outcomeValues.SEEN).toBe(0);
			expect(scored.current.numAttempts).toBe(0);
			fresh.dispatch({ action: 'endAttempt' });
			// A scorer re-running response processing on the ended attempt reads the same
			// number the candidate-side run did, so it computes the same outcomes.
			const scorer = definition.openSession({ restore: fresh.serialize() });
			try {
				const rescored = scorer.dispatch({ action: 'scoreAttempt' });
				expect(rescored.result?.scoring?.outcomeValues.SEEN).toBe(1);
				expect(rescored.result?.scoring?.score).toBe(1);
				expect(rescored.current.numAttempts).toBe(1);
			} finally {
				scorer.dispose();
			}
		} finally {
			fresh.dispose();
		}
	});

	test('an uncounted submitAttempt on a non-adaptive item does not count either', () => {
		const session = definition.openSession({ responses: { RESPONSE: 'A', HINT: true } });
		try {
			const hint = session.dispatch({ action: 'submitAttempt', countAttempt: false }).result;
			expect(hint?.scoring?.outcomeValues.SEEN).toBe(0);
			expect(hint?.numAttempts).toBe(0);
			const counted = session.dispatch({ action: 'submitAttempt' }).result;
			expect(counted?.scoring?.outcomeValues.SEEN).toBe(1);
			expect(counted?.numAttempts).toBe(1);
		} finally {
			session.dispose();
		}
	});
});

describe('numAttempts during response processing of an adaptive item (parity)', () => {
	test('counted attempts are numbered before response processing; hints are not', () => {
		const session = createAssessmentItemDefinition({ itemXml: ADAPTIVE_ITEM }).openSession({
			responses: { RESPONSE: 'B', HINT: true },
		});
		try {
			const hint = session.dispatch({ action: 'submitAttempt', countAttempt: false }).result;
			expect(hint?.scoring?.outcomeValues.SEEN).toBe(0);
			expect(hint?.numAttempts).toBe(0);
			session.dispatch({ action: 'setResponse', responseIdentifier: 'HINT', value: false });
			const first = session.dispatch({ action: 'submitAttempt' }).result;
			expect(first?.scoring?.outcomeValues.SEEN).toBe(1);
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			const second = session.dispatch({ action: 'endAttempt' }).result;
			expect(second?.scoring?.outcomeValues.SEEN).toBe(2);
			expect(second?.scoring?.score).toBe(0.5);
			expect(second?.numAttempts).toBe(2);
		} finally {
			session.dispose();
		}
	});
});
