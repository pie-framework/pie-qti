import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

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

describe('QTI item session lifecycle', () => {
	test('suspendAttempt serializes responses without response processing or attempt counting', () => {
		const player = new Player({ itemXml: QTI3_CHOICE_ITEM });

		player.setResponses({ RESPONSE: 'choice_A' });
		const result = player.suspendAttempt();

		expect(result.action).toBe('suspendAttempt');
		expect(result.lifecycleStatus).toBe('suspended');
		expect(result.numAttempts).toBe(0);
		expect(result.sessionState.responseVariables.RESPONSE.value).toBe('choice_A');
		expect('correctResponse' in result.sessionState.responseVariables.RESPONSE).toBe(false);
		expect(result.sessionState.outcomeVariables.SCORE.value).toBe(0);
		expect(result.sessionState.contextVariables.numAttempts.value).toBe(0);
		expect(result.sessionState.contextVariables.duration.value).toBeGreaterThanOrEqual(0);
	});

	test('scoreAttempt runs scoring without candidate attempt side effects', () => {
		const player = new Player({ itemXml: QTI3_CHOICE_ITEM });

		player.setResponses({ RESPONSE: 'choice_A' });
		const scoreOnly = player.scoreAttempt();

		expect(scoreOnly.action).toBe('scoreAttempt');
		expect(scoreOnly.scoring?.score).toBe(1);
		expect(scoreOnly.numAttempts).toBe(0);
		expect(scoreOnly.completionStatus).toBe('not_attempted');
		expect(scoreOnly.completed).toBe(false);

		const submitted = player.endAttempt();
		expect(submitted.scoring?.score).toBe(1);
		expect(submitted.numAttempts).toBe(1);
		expect(submitted.completionStatus).toBe('completed');
		expect(submitted.lifecycleStatus).toBe('closed');
	});

	test('runItemSessionAction exposes submitAttempt through the unified result protocol', () => {
		const player = new Player({ itemXml: QTI3_CHOICE_ITEM });

		player.setResponses({ RESPONSE: 'choice_A' });
		const result = player.runItemSessionAction({ action: 'submitAttempt' });

		expect(result.action).toBe('submitAttempt');
		expect(result.scoring?.score).toBe(1);
		expect(result.sessionState.responseVariables.RESPONSE.value).toBe('choice_A');
		expect(result.sessionState.outcomeVariables.SCORE.value).toBe(1);
		expect(result.numAttempts).toBe(1);
		expect(player.getNumAttempts()).toBe(1);
	});

	test('legacy submitAttempt delegates to the unified action protocol result', () => {
		const player = new Player({ itemXml: QTI3_CHOICE_ITEM });

		player.setResponses({ RESPONSE: 'choice_A' });
		const result = player.submitAttempt();

		expect(result.score).toBe(1);
		expect(result.completed).toBe(true);
		expect(player.getResponses().RESPONSE).toBe('choice_A');
	});

	test('restoreItemSession hydrates serialized variables for later scoring', () => {
		const first = new Player({ itemXml: QTI3_CHOICE_ITEM });
		first.setResponses({ RESPONSE: 'choice_A' });
		const saved = first.suspendAttempt().sessionState;

		const restored = new Player({ itemXml: QTI3_CHOICE_ITEM });
		restored.restoreItemSession(saved);
		const scored = restored.scoreAttempt();

		expect(restored.getResponses().RESPONSE).toBe('choice_A');
		expect(scored.scoring?.score).toBe(1);
		expect(scored.numAttempts).toBe(0);
	});

	test('newTemplate clears responses and reruns template processing', () => {
		const player = new Player({ itemXml: QTI3_TEMPLATE_ITEM });
		expect(player.getTemplateVariables().NUMBER).toBe(5);

		player.setResponses({ RESPONSE: 5 });
		player.endAttempt();
		expect(player.getNumAttempts()).toBe(1);
		expect(player.getResponses().RESPONSE).toBe(5);

		const result = player.newTemplate();

		expect(result.action).toBe('newTemplate');
		expect(player.getResponses().RESPONSE).toBeNull();
		expect(player.getTemplateVariables().NUMBER).toBe(5);
		expect(player.getNumAttempts()).toBe(0);
		expect(player.getCompletionStatus()).toBe('not_attempted');
		expect(result.sessionState.templateVariables.NUMBER.value).toBe(5);
	});
});
