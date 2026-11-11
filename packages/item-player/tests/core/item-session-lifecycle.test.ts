import { afterEach, describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession, OpenItemSessionOptions } from '../../src/core/ItemSession.js';

const QTI3_CHOICE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-session-choice"
  title="QTI 3 Session Choice"
  adaptive="false"
  time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>choice_A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>A class plants 8 bean seeds. Six seeds sprout. How many seeds did not sprout?</p>
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
      <qti-prompt>Select the correct answer.</qti-prompt>
      <qti-simple-choice identifier="choice_A">2</qti-simple-choice>
      <qti-simple-choice identifier="choice_B">6</qti-simple-choice>
      <qti-simple-choice identifier="choice_C">14</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

const QTI3_TEMPLATE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-template-item"
  title="QTI 3 Template Item"
  adaptive="false"
  time-dependent="false">
  <qti-template-declaration identifier="NUMBER" cardinality="single" base-type="integer">
    <qti-default-value>
      <qti-value>1</qti-value>
    </qti-default-value>
  </qti-template-declaration>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  <qti-template-processing>
    <qti-set-template-value identifier="NUMBER">
      <qti-base-value base-type="integer">5</qti-base-value>
    </qti-set-template-value>
  </qti-template-processing>
  <qti-item-body>
    <p>What is <qti-printed-variable identifier="NUMBER"/>?</p>
    <qti-text-entry-interaction response-identifier="RESPONSE"/>
  </qti-item-body>
</qti-assessment-item>`;

const openSessions: ItemSession[] = [];

function open(itemXml: string, options?: OpenItemSessionOptions): ItemSession {
	const session = createAssessmentItemDefinition({ itemXml }).openSession(options);
	openSessions.push(session);
	return session;
}

afterEach(() => {
	for (const session of openSessions.splice(0)) session.dispose();
});

describe('QTI item session lifecycle', () => {
	test('suspendAttempt serializes responses without response processing or attempt counting', () => {
		const session = open(QTI3_CHOICE_ITEM);

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'choice_A' });
		const { result, current } = session.dispatch({ action: 'suspendAttempt' });

		expect(result?.action).toBe('suspendAttempt');
		expect(result?.lifecycleStatus).toBe('suspended');
		expect(current.lifecycleStatus).toBe('suspended');
		expect(result?.numAttempts).toBe(0);
		expect(result?.sessionState.responseVariables.RESPONSE?.value).toBe('choice_A');
		// QTI ASI §10.3: the correct response is session state (a setCorrectResponse
		// template rule can compute it), so it travels with the snapshot.
		expect(result?.sessionState.responseVariables.RESPONSE?.correctResponse).toBe('choice_A');
		expect(result?.sessionState.outcomeVariables.SCORE?.value).toBe(0);
		expect(result?.sessionState.contextVariables.numAttempts?.value).toBe(0);
		expect(result?.sessionState.contextVariables.duration?.value).toBeGreaterThanOrEqual(0);
	});

	test('scoreAttempt runs scoring without candidate attempt side effects', () => {
		const session = open(QTI3_CHOICE_ITEM);

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'choice_A' });
		const scoreOnly = session.dispatch({ action: 'scoreAttempt' }).result;

		expect(scoreOnly?.action).toBe('scoreAttempt');
		expect(scoreOnly?.scoring?.score).toBe(1);
		expect(scoreOnly?.numAttempts).toBe(0);
		// The candidate's response change began the attempt (QTI ASI §5.2.1: unknown once the
		// attempt has begun); scoring without attempt side effects leaves it there — it does
		// not finalize a non-adaptive item, so it is not 'completed' either.
		expect(scoreOnly?.completionStatus).toBe('unknown');
		expect(scoreOnly?.completed).toBe(false);

		const submitted = session.dispatch({ action: 'endAttempt' }).result;
		expect(submitted?.scoring?.score).toBe(1);
		expect(submitted?.numAttempts).toBe(1);
		expect(submitted?.completionStatus).toBe('completed');
		expect(submitted?.lifecycleStatus).toBe('closed');
	});

	test('dispatch exposes submitAttempt through the unified result protocol', () => {
		const session = open(QTI3_CHOICE_ITEM);

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'choice_A' });
		const { result, current } = session.dispatch({ action: 'submitAttempt' });

		expect(result?.action).toBe('submitAttempt');
		expect(result?.scoring?.score).toBe(1);
		expect(result?.sessionState.responseVariables.RESPONSE?.value).toBe('choice_A');
		expect(result?.sessionState.outcomeVariables.SCORE?.value).toBe(1);
		expect(result?.numAttempts).toBe(1);
		expect(current.numAttempts).toBe(1);
	});

	test('a restored session hydrates serialized variables for later scoring', () => {
		const first = open(QTI3_CHOICE_ITEM);
		first.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'choice_A' });
		const saved = first.dispatch({ action: 'suspendAttempt' }).result?.sessionState;

		const restored = open(QTI3_CHOICE_ITEM, { restore: saved });
		const scored = restored.dispatch({ action: 'scoreAttempt' }).result;

		expect(restored.state().responses.RESPONSE).toBe('choice_A');
		expect(scored?.scoring?.score).toBe(1);
		expect(scored?.numAttempts).toBe(0);
	});

	test('newTemplate clears responses and reruns template processing', () => {
		const session = open(QTI3_TEMPLATE_ITEM);
		expect(session.state().templates.NUMBER).toBe(5);

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 5 });
		session.dispatch({ action: 'endAttempt' });
		expect(session.state().numAttempts).toBe(1);
		expect(session.state().responses.RESPONSE).toBe(5);

		const { result, current } = session.dispatch({ action: 'newTemplate' });

		expect(result?.action).toBe('newTemplate');
		expect(current.responses.RESPONSE).toBeNull();
		expect(current.templates.NUMBER).toBe(5);
		expect(current.numAttempts).toBe(0);
		expect(current.completionStatus).toBe('not_attempted');
		expect(current.lifecycleStatus).toBe('initial');
		expect(result?.sessionState.templateVariables.NUMBER?.value).toBe(5);
	});
});
