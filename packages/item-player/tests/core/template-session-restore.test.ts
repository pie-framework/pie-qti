import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

/**
 * QTI ASI §10.3: template processing fixes the item's template variables — and
 * template-rule effects such as setCorrectResponse — for the session. A session
 * restored from a snapshot therefore reproduces the same scoring behavior as the
 * session that was saved, without rerunning template processing.
 */
const QTI22_TEMPLATE_CORRECT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="template-correct-restore"
  title="Template setCorrectResponse restore"
  adaptive="false"
  timeDependent="false">
  <templateDeclaration identifier="KEY" cardinality="single" baseType="integer"/>
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <templateProcessing>
    <setTemplateValue identifier="KEY">
      <randomInteger min="1" max="10"/>
    </setTemplateValue>
    <setCorrectResponse identifier="RESPONSE">
      <sum>
        <variable identifier="KEY"/>
        <baseValue baseType="integer">10</baseValue>
      </sum>
    </setCorrectResponse>
  </templateProcessing>
  <itemBody>
    <p>Enter the key plus ten: <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="3"/></p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

/**
 * QTI ASI §10.3 + §5.1: setDefaultValue is a template rule that CHANGES the
 * variable's default value; later resets (attempt starts, outcome resets) use the
 * new default. A restored session keeps the default fixed by template processing.
 */
const QTI22_TEMPLATE_DEFAULT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="template-default-restore"
  title="Template setDefaultValue restore"
  adaptive="false"
  timeDependent="false">
  <templateDeclaration identifier="SOURCE" cardinality="single" baseType="integer">
    <defaultValue><value>1</value></defaultValue>
  </templateDeclaration>
  <responseDeclaration identifier="R" cardinality="single" baseType="identifier">
    <defaultValue><value>A</value></defaultValue>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <templateProcessing>
    <setTemplateValue identifier="SOURCE">
      <randomInteger min="2" max="3"/>
    </setTemplateValue>
    <setDefaultValue identifier="R">
      <baseValue baseType="identifier">C</baseValue>
    </setDefaultValue>
  </templateProcessing>
  <itemBody>
    <p>Answer.</p>
    <choiceInteraction responseIdentifier="R" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
      <simpleChoice identifier="C">C</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="R"/>
          <baseValue baseType="identifier">C</baseValue>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

describe('templated item session restore', () => {
	test('restored templated session keeps the computed correct response and scores identically', () => {
		const definition = createAssessmentItemDefinition({ itemXml: QTI22_TEMPLATE_CORRECT_ITEM, seed: 7 });

		const first = definition.openSession();
		const key = first.state().templates.KEY as number;
		const correct = key + 10;
		expect(key).toBeGreaterThanOrEqual(1);
		expect(key).toBeLessThanOrEqual(10);

		first.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: correct });
		const ended = first.dispatch({ action: 'endAttempt' });
		expect(ended.result?.scoring?.score).toBe(1);
		const saved = first.serialize();
		first.dispose();

		// The computed correct response travels with the snapshot (QTI ASI §10.3:
		// templateRule effects are fixed for the session).
		expect(saved.responseVariables.RESPONSE.correctResponse).toEqual(correct);

		const reopened = definition.openSession({ restore: saved });
		expect(reopened.state().templates.KEY).toBe(key);
		expect(reopened.state().responses.RESPONSE).toBe(correct);
		const rescored = reopened.dispatch({ action: 'scoreAttempt' });
		expect(rescored.result?.scoring?.score).toBe(1);
		reopened.dispose();
	});

	test('restore keeps the newTemplate reset default fixed by template processing', () => {
		const definition = createAssessmentItemDefinition({ itemXml: QTI22_TEMPLATE_DEFAULT_ITEM, seed: 11 });

		const first = definition.openSession();
		expect(first.state().templates.SOURCE).toBeGreaterThanOrEqual(2);
		// setDefaultValue(R, C) replaces the declared default "A" for this session.
		expect(first.state().responses.R).toBe('C');
		const saved = first.serialize();
		first.dispose();

		expect(saved.responseVariables.R.defaultValue).toBe('C');

		const reopened = definition.openSession({ restore: saved });
		// The restored session keeps the default its template processing fixed.
		expect(reopened.serialize().responseVariables.R?.defaultValue).toBe('C');
		// A new instance (newTemplate) starts from the declarations and its template
		// processing fixes the default again.
		reopened.dispatch({ action: 'newTemplate' });
		expect(reopened.state().responses.R).toBe('C');
		reopened.dispose();
	});

	test('every serialized variable carries defaultValue, null when it has none', () => {
		const definition = createAssessmentItemDefinition({ itemXml: QTI22_TEMPLATE_CORRECT_ITEM, seed: 7 });
		const session = definition.openSession();
		const saved = session.serialize();
		session.dispose();

		const variables = [
			...Object.values(saved.responseVariables),
			...Object.values(saved.outcomeVariables),
			...Object.values(saved.templateVariables),
			...Object.values(saved.contextVariables),
		];
		expect(variables.length).toBeGreaterThan(0);
		for (const variable of variables) expect(variable).toHaveProperty('defaultValue');
		// RESPONSE declares no default value; SCORE declares 0.
		expect(saved.responseVariables.RESPONSE?.defaultValue).toBeNull();
		expect(saved.outcomeVariables.SCORE?.defaultValue).toBe(0);
	});
});
