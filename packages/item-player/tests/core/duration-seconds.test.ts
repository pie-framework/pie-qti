import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

/**
 * QTI 2.2/3.0 define the built-in `duration` response variable as the accumulated time on the
 * item in seconds (a float, truncated), and bind item-XML duration literals to xsd:double
 * seconds. The host-facing `duration` fields of serialized sessions and action results keep
 * reporting milliseconds. (PCI variable JSON is the one place durations travel as ISO 8601 —
 * see qtiVariableJson.test.ts.)
 */

const T0 = new Date('2026-01-01T00:00:00.000Z');

function timedItem(): string {
	return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="timed" adaptive="false" timeDependent="true">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<outcomeDeclaration identifier="UNDER_13S" cardinality="single" baseType="boolean"/>
	<outcomeDeclaration identifier="AT_LEAST_12S" cardinality="single" baseType="boolean"/>
	<outcomeDeclaration identifier="AT_LEAST_12S_EXACT" cardinality="single" baseType="boolean"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing>
		<setOutcomeValue identifier="UNDER_13S">
			<durationLT><variable identifier="duration"/><baseValue baseType="duration">13</baseValue></durationLT>
		</setOutcomeValue>
		<setOutcomeValue identifier="AT_LEAST_12S">
			<durationGTE><variable identifier="duration"/><baseValue baseType="duration">12.3</baseValue></durationGTE>
		</setOutcomeValue>
		<setOutcomeValue identifier="AT_LEAST_12S_EXACT">
			<durationGTE><variable identifier="duration"/><baseValue baseType="duration">12</baseValue></durationGTE>
		</setOutcomeValue>
	</responseProcessing>
</assessmentItem>`;
}

/** QTI binds item-XML durations to xsd:double seconds; PT12S is not an XML duration. */
function isoDurationItem(): string {
	return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="isoTimed" adaptive="false" timeDependent="true">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<outcomeDeclaration identifier="AT_LEAST_PT12S" cardinality="single" baseType="boolean"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing>
		<setOutcomeValue identifier="AT_LEAST_PT12S">
			<durationGTE><variable identifier="duration"/><baseValue baseType="duration">PT12S</baseValue></durationGTE>
		</setOutcomeValue>
	</responseProcessing>
</assessmentItem>`;
}

afterEach(() => {
	setSystemTime();
});

describe('built-in duration variable', () => {
	test('response processing compares the duration in seconds', () => {
		setSystemTime(T0);
		const session = createAssessmentItemDefinition({ itemXml: timedItem() }).openSession();
		setSystemTime(new Date(T0.getTime() + 12_345));

		const result = session.dispatch({ action: 'endAttempt' }).result;

		expect(result?.scoring?.outcomeValues).toMatchObject({
			UNDER_13S: true,
			AT_LEAST_12S: true,
			AT_LEAST_12S_EXACT: true,
		});
		session.dispose();
	});

	test('an ISO 8601 duration literal in item XML is invalid, not a threshold', () => {
		setSystemTime(T0);
		const session = createAssessmentItemDefinition({ itemXml: isoDurationItem() }).openSession();
		setSystemTime(new Date(T0.getTime() + 12_345));

		const result = session.dispatch({ action: 'endAttempt' }).result;

		// The coercion is invalid, so the outcome is never set to true — and the player does not
		// publish invalid outcomes at all (PT12S is not an xsd:double duration).
		expect(result?.scoring?.outcomeValues?.AT_LEAST_PT12S).toBeUndefined();
		session.dispose();
	});

	test('the QTI variable is seconds while the host-facing fields stay milliseconds', () => {
		setSystemTime(T0);
		const session = createAssessmentItemDefinition({ itemXml: timedItem() }).openSession();
		setSystemTime(new Date(T0.getTime() + 2_500));

		const result = session.dispatch({ action: 'scoreAttempt' }).result;

		expect(result?.duration).toBe(2_500);
		expect(result?.sessionState.duration).toBe(2_500);
		expect(result?.sessionState.contextVariables.duration).toMatchObject({
			baseType: 'duration',
			cardinality: 'single',
			value: 2.5,
		});
		expect(result?.scoring?.outcomeValues.duration).toBe(2.5);
		expect(session.state().duration).toBe(2_500);
		expect(session.state().context.duration).toBe(2.5);
		session.dispose();
	});

	test('a restored session continues from its saved milliseconds', () => {
		setSystemTime(T0);
		const definition = createAssessmentItemDefinition({ itemXml: timedItem() });
		const first = definition.openSession();
		setSystemTime(new Date(T0.getTime() + 5_000));
		const saved = first.serialize();
		first.dispose();
		expect(saved.duration).toBe(5_000);
		expect(saved.contextVariables.duration?.value).toBe(5);

		setSystemTime(new Date(T0.getTime() + 60_000));
		const restored = definition.openSession({ restore: saved });
		setSystemTime(new Date(T0.getTime() + 61_250));
		const state = restored.serialize();

		expect(state.duration).toBe(6_250);
		expect(state.contextVariables.duration?.value).toBe(6.25);
		restored.dispose();
	});
});
